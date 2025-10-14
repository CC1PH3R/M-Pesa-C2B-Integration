/**
 * M-Pesa Service - Handles all M-Pesa API interactions
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const mpesaConfig = require('../config/mpesa');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class MpesaService {
  /**
   * Generate M-Pesa access token with caching
   */
  async getAccessToken() {
    try {
      // Add 5 minute buffer to ensure token is valid
      const bufferTime = new Date(Date.now() + (5 * 60 * 1000));
      
      // Check if we have a valid cached token
      const cachedToken = await prisma.accessToken.findFirst({
        where: {
          expiresAt: {
            gt: bufferTime
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (cachedToken) {
        const timeRemaining = Math.floor((cachedToken.expiresAt - new Date()) / 1000);
        logger.info('Using cached access token', { 
          expiresAt: cachedToken.expiresAt,
          secondsRemaining: timeRemaining
        });
        return cachedToken.token;
      }

      logger.info('Generating new access token');

      // Clear old tokens first
      await prisma.accessToken.deleteMany({});

      // Generate new token
      const auth = Buffer.from(
        `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`
      ).toString('base64');

      logger.info('Making auth request', {
        url: `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`,
        consumerKeyLength: mpesaConfig.consumerKey?.length,
        consumerSecretLength: mpesaConfig.consumerSecret?.length
      });

      const response = await axios.get(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      logger.info('Auth response received', {
        status: response.status,
        hasAccessToken: !!response.data.access_token,
        expiresIn: response.data.expires_in
      });

      const { access_token, expires_in } = response.data;
      
      if (!access_token) {
        throw new Error('No access token in response');
      }

      // Cache the token with 5 minute buffer (expires_in is in seconds)
      const expiresAt = new Date(Date.now() + ((expires_in - 300) * 1000));
      
      await prisma.accessToken.create({
        data: {
          token: access_token,
          expiresAt
        }
      });

      logger.info('Access token generated and cached', { 
        expiresAt,
        expiresInSeconds: expires_in,
        tokenLength: access_token.length
      });

      return access_token;

    } catch (error) {
      logger.error('Failed to get access token', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          headers: error.config?.headers
        }
      });
      throw new Error(`M-Pesa auth failed: ${error.message}`);
    }
  }

  /**
   * Register C2B URLs with M-Pesa (v2 API)
   * 
   * C2B v2 Requirements:
   * - ValidationURL is optional (can use same as ConfirmationURL)
   * - URLs cannot contain keywords: mpesa, safaricom, money, pay, payment
   * - ResponseType: Completed or Cancelled
   */
  async registerC2BUrls() {
    try {
      // Get access token
      const token = await this.getAccessToken();
      logger.info('Access token obtained for C2B v2 registration');

      // Get confirmation URL
      const { confirmation } = mpesaConfig.getCallbackURLs();

      // Validate URL doesn't contain blocked keywords
      const blockedKeywords = ['mpesa', 'safaricom', 'money', 'pay', 'payment'];
      const urlLower = confirmation.toLowerCase();
      const foundKeyword = blockedKeywords.find(keyword => urlLower.includes(keyword));
      
      if (foundKeyword) {
        throw new Error(
          `Callback URL contains blocked keyword '${foundKeyword}'. ` +
          `Daraja C2B v2 rejects URLs with: ${blockedKeywords.join(', ')}`
        );
      }

      // Build payload for C2B v2
      const payload = {
        ShortCode: mpesaConfig.shortcode,
        ResponseType: mpesaConfig.responseType,
        ConfirmationURL: confirmation,
        ValidationURL: confirmation // Use same URL to skip validation
      };

      logger.info('Attempting C2B v2 URL registration', {
        shortCode: payload.ShortCode,
        confirmationURL: payload.ConfirmationURL,
        responseType: payload.ResponseType,
        apiVersion: 'v2'
      });

      // Make API request to v2 endpoint
      const url = `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bRegister}`;
      logger.info('Calling M-Pesa C2B v2 API', { url });

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      logger.info('M-Pesa C2B v2 response received', {
        status: response.status,
        data: response.data
      });

      // Check if registration was successful
      const success = response.data.ResponseCode === '0' || 
                     response.data.ResponseDescription?.toLowerCase().includes('success');

      // Log registration attempt
      await prisma.urlRegistration.create({
        data: {
          shortCode: mpesaConfig.shortcode,
          responseType: mpesaConfig.responseType,
          confirmationURL: confirmation,
          validationURL: confirmation,
          success: success,
          response: response.data
        }
      });

      if (success) {
        logger.info('C2B v2 URLs registered successfully');
      } else {
        logger.warn('C2B v2 registration completed but may have issues', response.data);
      }

      return response.data;

    } catch (error) {
      // Enhanced error logging
      const errorDetails = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorCode: error.response?.data?.errorCode,
        errorMessage: error.response?.data?.errorMessage,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method
        }
      };

      logger.error('Failed to register C2B v2 URLs', errorDetails);
      
      // Log failed registration
      try {
        const { confirmation } = mpesaConfig.getCallbackURLs();
        await prisma.urlRegistration.create({
          data: {
            shortCode: mpesaConfig.shortcode,
            responseType: mpesaConfig.responseType,
            confirmationURL: confirmation,
            validationURL: confirmation,
            success: false,
            response: {
              error: error.message,
              mpesaError: error.response?.data,
              statusCode: error.response?.status
            }
          }
        });
      } catch (dbError) {
        logger.error('Failed to log registration error', dbError);
      }

      throw error;
    }
  }

  /**
   * Save C2B confirmation callback to database
   */
  async saveConfirmation(callbackData) {
    try {
      const transaction = await prisma.transaction.create({
        data: {
          transactionType: callbackData.TransactionType,
          transID: callbackData.TransID,
          transTime: callbackData.TransTime,
          transAmount: parseFloat(callbackData.TransAmount),
          businessShortCode: callbackData.BusinessShortCode,
          billRefNumber: callbackData.BillRefNumber || null,
          invoiceNumber: callbackData.InvoiceNumber || null,
          msisdn: callbackData.MSISDN,
          firstName: callbackData.FirstName || null,
          middleName: callbackData.MiddleName || null,
          lastName: callbackData.LastName || null,
          orgAccountBalance: callbackData.OrgAccountBalance 
            ? parseFloat(callbackData.OrgAccountBalance) 
            : null,
          rawCallback: callbackData,
          processed: true
        }
      });

      logger.info('Transaction saved successfully', {
        id: transaction.id,
        transID: transaction.transID,
        amount: transaction.transAmount
      });

      return transaction;

    } catch (error) {
      logger.error('Failed to save transaction', error);
      
      // Try to save with error flag
      try {
        await prisma.transaction.create({
          data: {
            transactionType: callbackData.TransactionType || 'Unknown',
            transID: callbackData.TransID || `error-${Date.now()}`,
            transTime: callbackData.TransTime || new Date().toISOString(),
            transAmount: parseFloat(callbackData.TransAmount || 0),
            businessShortCode: callbackData.BusinessShortCode || '',
            msisdn: callbackData.MSISDN || '',
            rawCallback: callbackData,
            processed: false,
            processingError: error.message
          }
        });
      } catch (saveError) {
        logger.error('Failed to save error transaction', saveError);
      }

      throw error;
    }
  }

  /**
   * Get all transactions
   */
  async getAllTransactions(limit = 50) {
    try {
      return await prisma.transaction.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });
    } catch (error) {
      logger.error('Failed to fetch transactions', error);
      throw error;
    }
  }

  /**
   * Get transaction by M-Pesa TransID
   */
  async getTransactionByTransID(transID) {
    try {
      return await prisma.transaction.findUnique({
        where: { transID }
      });
    } catch (error) {
      logger.error('Failed to fetch transaction', error);
      throw error;
    }
  }

  /**
   * Simulate C2B Payment (for testing only)
   */
  async simulateC2B(amount, msisdn, billRefNumber = 'TestAccount') {
    try {
      const token = await this.getAccessToken();

      const payload = {
        ShortCode: mpesaConfig.shortcode,
        CommandID: 'CustomerPayBillOnline',
        Amount: amount,
        Msisdn: msisdn,
        BillRefNumber: billRefNumber
      };

      logger.info('Simulating C2B payment', payload);

      const response = await axios.post(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bSimulate}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('C2B simulation response', response.data);
      return response.data;

    } catch (error) {
      logger.error('Failed to simulate C2B', error);
      throw error;
    }
  }
}

module.exports = new MpesaService();
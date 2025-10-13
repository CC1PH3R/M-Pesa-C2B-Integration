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
      // Check if we have a valid cached token
      const cachedToken = await prisma.accessToken.findFirst({
        where: {
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (cachedToken) {
        logger.info('Using cached access token');
        return cachedToken.token;
      }

      // Generate new token
      const auth = Buffer.from(
        `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`
      ).toString('base64');

      const response = await axios.get(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );

      const { access_token, expires_in } = response.data;
      
      // Cache the token (expires_in is in seconds)
      const expiresAt = new Date(Date.now() + (expires_in * 1000) - 60000); // 1 min buffer
      
      await prisma.accessToken.create({
        data: {
          token: access_token,
          expiresAt
        }
      });

      logger.info('Generated new access token', { expiresAt });
      return access_token;

    } catch (error) {
      logger.error('Failed to get access token', error);
      throw new Error(`M-Pesa auth failed: ${error.message}`);
    }
  }

  /**
   * Register C2B URLs with M-Pesa
   */
  async registerC2BUrls() {
    try {
      const token = await this.getAccessToken();
      const { confirmation, validation } = mpesaConfig.getCallbackURLs();

      const payload = {
        ShortCode: mpesaConfig.shortcode,
        ResponseType: mpesaConfig.responseType,
        ConfirmationURL: confirmation,
        ValidationURL: validation
      };

      logger.info('Registering C2B URLs', payload);

      const response = await axios.post(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bRegister}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Log registration
      await prisma.urlRegistration.create({
        data: {
          shortCode: mpesaConfig.shortcode,
          responseType: mpesaConfig.responseType,
          confirmationURL: confirmation,
          validationURL: validation,
          success: response.data.ResponseCode === '0',
          response: response.data
        }
      });

      logger.info('C2B URLs registered successfully', response.data);
      return response.data;

    } catch (error) {
      logger.error('Failed to register C2B URLs', error);
      
      // Log failed registration
      const { confirmation, validation } = mpesaConfig.getCallbackURLs();
      await prisma.urlRegistration.create({
        data: {
          shortCode: mpesaConfig.shortcode,
          responseType: mpesaConfig.responseType,
          confirmationURL: confirmation,
          validationURL: validation,
          success: false,
          response: { error: error.message }
        }
      });

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
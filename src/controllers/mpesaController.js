/**
 * M-Pesa Controller - Handles HTTP requests and responses
 */

const mpesaService = require('../services/mpesaService');
const logger = require('../utils/logger');

class MpesaController {
  /**
   * Register C2B URLs
   */
  async registerUrls(req, res) {
    try {
      logger.info('Register URLs endpoint called', {
        method: req.method,
        url: req.url
      });

      const result = await mpesaService.registerC2BUrls();
      
      return res.status(200).json({
        success: true,
        message: 'C2B URLs registered successfully',
        data: result
      });
    } catch (error) {
      logger.error('Register URLs controller error', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to register C2B URLs',
        error: error.message,
        mpesaError: error.response?.data,
        hint: 'Check logs for detailed error information'
      });
    }
  }

  /**
   * C2B Confirmation callback
   * M-Pesa calls this to confirm a successful payment
   */
  async confirmation(req, res) {
    try {
      logger.info('Confirmation callback received', req.body);

      // Respond immediately to M-Pesa (must be within 30 seconds)
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success'
      });

      // Process the transaction asynchronously
      // This ensures we respond to M-Pesa quickly
      setImmediate(async () => {
        try {
          await mpesaService.saveConfirmation(req.body);
          logger.info('Transaction processed successfully');
        } catch (error) {
          logger.error('Failed to process confirmation', error);
        }
      });

    } catch (error) {
      logger.error('Confirmation callback error', error);
      
      // Still return success to M-Pesa
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success'
      });
    }
  }

  /**
   * Get all transactions
   */
  async getTransactions(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const transactions = await mpesaService.getAllTransactions(limit);
      
      return res.status(200).json({
        success: true,
        count: transactions.length,
        data: transactions
      });
    } catch (error) {
      logger.error('Get transactions controller error', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: error.message
      });
    }
  }

  /**
   * Get single transaction by TransID
   */
  async getTransaction(req, res) {
    try {
      const { transID } = req.params;
      const transaction = await mpesaService.getTransactionByTransID(transID);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: transaction
      });
    } catch (error) {
      logger.error('Get transaction controller error', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch transaction',
        error: error.message
      });
    }
  }

  /**
   * Simulate C2B payment (testing only)
   */
  async simulate(req, res) {
    try {
      const { amount, msisdn, billRefNumber } = req.body;

      if (!amount || !msisdn) {
        return res.status(400).json({
          success: false,
          message: 'Amount and msisdn are required'
        });
      }

      const result = await mpesaService.simulateC2B(amount, msisdn, billRefNumber);
      
      return res.status(200).json({
        success: true,
        message: 'Payment simulation sent',
        data: result
      });
    } catch (error) {
      logger.error('Simulate payment controller error', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to simulate payment',
        error: error.message
      });
    }
  }

  /**
   * Test access token generation and validity (C2B v2)
   */
  async testAuth(req, res) {
    try {
      logger.info('Testing authentication with C2B v2');

      // Force generate new token
      const mpesaService = require('../services/mpesaService');
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // Clear cached tokens
      await prisma.accessToken.deleteMany({});
      logger.info('Cleared cached tokens');

      // Generate fresh token
      const token = await mpesaService.getAccessToken();
      
      // Test token by making a C2B v2 API call
      const axios = require('axios');
      const mpesaConfig = require('../config/mpesa');
      
      try {
        // Try to register URLs with fresh token (v2 endpoint)
        const testResponse = await axios.post(
          `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bRegister}`,
          {
            ShortCode: mpesaConfig.shortcode,
            ResponseType: mpesaConfig.responseType,
            ConfirmationURL: `${mpesaConfig.appBaseURL}/api/ganji/confirmation`,
            ValidationURL: `${mpesaConfig.appBaseURL}/api/ganji/confirmation`
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        return res.status(200).json({
          success: true,
          message: 'Token is valid and C2B v2 registration successful',
          apiVersion: 'v2',
          tokenInfo: {
            length: token.length,
            prefix: token.substring(0, 20) + '...',
          },
          mpesaResponse: testResponse.data
        });

      } catch (apiError) {
        return res.status(200).json({
          success: false,
          message: 'Token generated but C2B v2 API call failed',
          apiVersion: 'v2',
          tokenInfo: {
            length: token.length,
            prefix: token.substring(0, 20) + '...',
          },
          error: {
            status: apiError.response?.status,
            code: apiError.response?.data?.errorCode,
            message: apiError.response?.data?.errorMessage,
            fullError: apiError.response?.data
          }
        });
      }

    } catch (error) {
      logger.error('Test auth failed', error);
      
      return res.status(500).json({
        success: false,
        message: 'Authentication test failed',
        error: error.message,
        details: error.response?.data
      });
    }
  }

  /**
   * Health check endpoint
   */
  async health(req, res) {
    return res.status(200).json({
      success: true,
      message: 'M-Pesa C2B API is running',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new MpesaController();
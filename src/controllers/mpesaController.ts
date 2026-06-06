/**
 * M-Pesa Controller - Handles HTTP requests and responses
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import mpesaService from '../services/mpesaService';
import mpesaConfig from '../config/mpesa';
import logger from '../utils/logger';

class MpesaController {
  /**
   * Register C2B URLs
   */
  async registerUrls(req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Register URLs endpoint called', {
        method: req.method,
        url: req.url,
      });

      const result = await mpesaService.registerC2BUrls();

      return res.status(200).json({
        success: true,
        message: 'C2B URLs registered successfully',
        data: result,
      });
    } catch (error) {
      const err = error as { message: string; response?: { data: unknown; status: number } };
      logger.error('Register URLs controller error', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to register C2B URLs',
        error: err.message,
        mpesaError: err.response?.data,
        hint: 'Check logs for detailed error information',
      });
    }
  }

  /**
   * C2B Confirmation callback
   * M-Pesa calls this to confirm a successful payment
   */
  async confirmation(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Confirmation callback received', req.body as Record<string, unknown>);

      // Respond immediately to M-Pesa (must be within 30 seconds)
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });

      // Process the transaction asynchronously
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
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });
    }
  }

  /**
   * Get all transactions
   */
  async getTransactions(req: Request, res: Response): Promise<Response> {
    try {
      const limit = parseInt((req.query.limit as string) ?? '50') || 50;
      const transactions = await mpesaService.getAllTransactions(limit);

      return res.status(200).json({
        success: true,
        count: transactions.length,
        data: transactions,
      });
    } catch (error) {
      logger.error('Get transactions controller error', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get single transaction by TransID
   */
  async getTransaction(req: Request, res: Response): Promise<Response> {
    try {
      const { transID } = req.params;
      const transaction = await mpesaService.getTransactionByTransID(transID);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error('Get transaction controller error', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch transaction',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Simulate C2B payment (testing only)
   */
  async simulate(req: Request, res: Response): Promise<Response> {
    try {
      const { amount, msisdn, billRefNumber } = req.body as {
        amount: string;
        msisdn: string;
        billRefNumber?: string;
      };

      if (!amount || !msisdn) {
        return res.status(400).json({
          success: false,
          message: 'Amount and msisdn are required',
        });
      }

      const result = await mpesaService.simulateC2B(amount, msisdn, billRefNumber);

      return res.status(200).json({
        success: true,
        message: 'Payment simulation sent',
        data: result,
      });
    } catch (error) {
      logger.error('Simulate payment controller error', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to simulate payment',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Test access token generation and validity (C2B v2)
   */
  async testAuth(req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Testing authentication with C2B v2');

      const prisma = new PrismaClient();

      // Clear cached tokens
      await prisma.accessToken.deleteMany({});
      logger.info('Cleared cached tokens');

      // Generate fresh token
      const token = await mpesaService.getAccessToken();

      try {
        const testResponse = await axios.post(
          `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bRegister}`,
          {
            ShortCode: mpesaConfig.shortcode,
            ResponseType: mpesaConfig.responseType,
            ConfirmationURL: `${mpesaConfig.appBaseURL}/api/ganji/confirmation`,
            ValidationURL: `${mpesaConfig.appBaseURL}/api/ganji/confirmation`,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
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
          mpesaResponse: testResponse.data,
        });
      } catch (apiError) {
        const err = apiError as { response?: { status: number; data: { errorCode?: string; errorMessage?: string } } };
        return res.status(200).json({
          success: false,
          message: 'Token generated but C2B v2 API call failed',
          apiVersion: 'v2',
          tokenInfo: {
            length: token.length,
            prefix: token.substring(0, 20) + '...',
          },
          error: {
            status: err.response?.status,
            code: err.response?.data?.errorCode,
            message: err.response?.data?.errorMessage,
            fullError: err.response?.data,
          },
        });
      }
    } catch (error) {
      logger.error('Test auth failed', error);
      const err = error as { message: string; response?: { data: unknown } };

      return res.status(500).json({
        success: false,
        message: 'Authentication test failed',
        error: err.message,
        details: err.response?.data,
      });
    }
  }

  /**
   * Health check endpoint
   */
  async health(_req: Request, res: Response): Promise<Response> {
    return res.status(200).json({
      success: true,
      message: 'M-Pesa C2B API is running',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new MpesaController();

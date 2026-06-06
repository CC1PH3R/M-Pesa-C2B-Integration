import { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import mpesaService from '../services/mpesaService';
import mpesaConfig from '../config/mpesa';
import logger from '../utils/logger';

const prisma = new PrismaClient();

class MpesaController {
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
      const axiosError = error as AxiosError<Record<string, unknown>>;
      logger.error('Register URLs controller error', {
        message: axiosError.message,
        response: axiosError.response?.data,
        status: axiosError.response?.status,
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to register C2B URLs',
        error: axiosError.message,
        mpesaError: axiosError.response?.data,
        hint: 'Check logs for detailed error information',
      });
    }
  }

  async confirmation(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Confirmation callback received', req.body);

      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });

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

      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<Response> {
    try {
      const limit = parseInt((req.query['limit'] as string) ?? '50') || 50;
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

  async getTransaction(req: Request, res: Response): Promise<Response> {
    try {
      const transID = req.params['transID'] as string;
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

  async simulate(req: Request, res: Response): Promise<Response> {
    try {
      const { amount, msisdn, billRefNumber } = req.body as {
        amount?: string;
        msisdn?: string;
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

  async testAuth(req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Testing authentication with C2B v2');

      await prisma.accessToken.deleteMany({});
      logger.info('Cleared cached tokens');

      const token = await mpesaService.getAccessToken();

      try {
        const testResponse = await axios.post<Record<string, unknown>>(
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
          },
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
        const axiosApiError = apiError as AxiosError<Record<string, unknown>>;
        return res.status(200).json({
          success: false,
          message: 'Token generated but C2B v2 API call failed',
          apiVersion: 'v2',
          tokenInfo: {
            length: token.length,
            prefix: token.substring(0, 20) + '...',
          },
          error: {
            status: axiosApiError.response?.status,
            code: axiosApiError.response?.data?.['errorCode'],
            message: axiosApiError.response?.data?.['errorMessage'],
            fullError: axiosApiError.response?.data,
          },
        });
      }
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      logger.error('Test auth failed', error);

      return res.status(500).json({
        success: false,
        message: 'Authentication test failed',
        error: axiosError.message,
        details: axiosError.response?.data,
      });
    }
  }

  async health(_req: Request, res: Response): Promise<Response> {
    return res.status(200).json({
      success: true,
      message: 'M-Pesa C2B API is running',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new MpesaController();

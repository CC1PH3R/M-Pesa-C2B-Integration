import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import mpesaService from '../services/mpesaService';

const prisma = new PrismaClient();

class MpesaController {
  async registerUrls(req: Request, res: Response): Promise<Response> {
    try {
      console.log('Register URLs endpoint called', req.method, req.url);

      const result = await mpesaService.registerC2BUrls();

      return res.status(200).json({
        success: true,
        message: 'C2B URLs registered successfully',
        data: result,
      });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      console.error('Register URLs controller error', axiosError.message, axiosError.response?.data);

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
      console.log('Confirmation callback received', req.body);

      res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Success',
      });

      setImmediate(async () => {
        try {
          await mpesaService.saveConfirmation(req.body);
          console.log('Transaction processed successfully');
        } catch (error) {
          console.error('Failed to process confirmation', error);
        }
      });
    } catch (error) {
      console.error('Confirmation callback error', error);

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
      console.error('Get transactions controller error', error);

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
      console.error('Get transaction controller error', error);

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
      console.error('Simulate payment controller error', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to simulate payment',
        error: (error as Error).message,
      });
    }
  }

  async testAuth(_req: Request, res: Response): Promise<Response> {
    try {
      console.log('Testing authentication');

      await prisma.accessToken.deleteMany({});
      console.log('Cleared cached tokens');

      const token = await mpesaService.getAccessToken();

      return res.status(200).json({
        success: true,
        message: 'Authentication successful',
        tokenInfo: {
          length: token.length,
          prefix: token.substring(0, 20) + '...',
        },
      });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      console.error('Test auth failed', error);

      return res.status(500).json({
        success: false,
        message: 'Authentication failed',
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

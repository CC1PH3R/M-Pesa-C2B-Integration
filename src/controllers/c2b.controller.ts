import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import c2bService from '../services/c2b.service';
import { createLogger } from '../lib/logger';

const log = createLogger('c2b:controller');

class C2BController {
  async registerUrls(req: Request, res: Response): Promise<Response> {
    try {
      log.info({ method: req.method, url: req.url }, 'Register URLs endpoint called');

      const result = await c2bService.registerC2BUrls();

      return res.status(200).json({
        success: true,
        message: 'C2B URLs registered successfully',
        data: result,
      });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      log.error({ err: axiosError, mpesaError: axiosError.response?.data }, 'Register URLs controller error');

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
      log.info({ body: req.body }, 'Confirmation callback received');

      // Always respond 200 immediately so M-Pesa does not retry
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

      setImmediate(async () => {
        try {
          await c2bService.saveConfirmation(req.body);
          log.info('Transaction processed successfully');
        } catch (error) {
          log.error({ err: error }, 'Failed to process confirmation');
        }
      });
    } catch (error) {
      log.error({ err: error }, 'Confirmation callback error');
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<Response> {
    try {
      const limit = parseInt((req.query['limit'] as string) ?? '50') || 50;
      const transactions = await c2bService.getAllTransactions(limit);

      return res.status(200).json({
        success: true,
        count: transactions.length,
        data: transactions,
      });
    } catch (error) {
      log.error({ err: error }, 'Get transactions controller error');

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
      const transaction = await c2bService.getTransactionByTransID(transID);

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
      log.error({ err: error }, 'Get transaction controller error');

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

      const result = await c2bService.simulateC2B(amount, msisdn, billRefNumber);

      return res.status(200).json({
        success: true,
        message: 'Payment simulation sent',
        data: result,
      });
    } catch (error) {
      log.error({ err: error }, 'Simulate payment controller error');

      return res.status(500).json({
        success: false,
        message: 'Failed to simulate payment',
        error: (error as Error).message,
      });
    }
  }
}

export default new C2BController();

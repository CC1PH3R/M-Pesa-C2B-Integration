import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import c2bService from '../services/c2b.service';

class C2BController {
  async registerUrls(req: Request, res: Response): Promise<Response> {
    try {
      console.log('Register URLs endpoint called', req.method, req.url);

      const result = await c2bService.registerC2BUrls();

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

      // Always respond 200 immediately so M-Pesa does not retry
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

      setImmediate(async () => {
        try {
          await c2bService.saveConfirmation(req.body);
          console.log('Transaction processed successfully');
        } catch (error) {
          console.error('Failed to process confirmation', error);
        }
      });
    } catch (error) {
      console.error('Confirmation callback error', error);
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

      const result = await c2bService.simulateC2B(amount, msisdn, billRefNumber);

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
}

export default new C2BController();

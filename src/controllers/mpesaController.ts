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

  // ─────────────────────────────────────────────
  // STK Push (Lipa Na M-Pesa / M-Pesa Express)
  // ─────────────────────────────────────────────

  async stkPush(req: Request, res: Response): Promise<Response> {
    try {
      const { phoneNumber, amount, accountRef, description } = req.body as {
        phoneNumber?: string;
        amount?: number;
        accountRef?: string;
        description?: string;
      };

      if (!phoneNumber || amount == null || !accountRef) {
        return res.status(400).json({
          success: false,
          message: 'phoneNumber, amount and accountRef are required',
        });
      }

      // Validate phone number format: must start with 2547 or 2541
      if (!/^2547\d{8}$|^2541\d{8}$/.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'phoneNumber must be in format 2547XXXXXXXX or 2541XXXXXXXX',
        });
      }

      if (!Number.isInteger(amount) || amount < 1) {
        return res.status(400).json({
          success: false,
          message: 'amount must be a whole number of at least 1 KES',
        });
      }

      const result = await mpesaService.initiateStkPush(
        phoneNumber,
        amount,
        accountRef,
        description,
      );

      return res.status(200).json({
        success: true,
        message: 'STK Push initiated — customer will receive a payment prompt',
        data: result,
      });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      console.error('STK Push controller error', axiosError.message, axiosError.response?.data);

      return res.status(500).json({
        success: false,
        message: 'Failed to initiate STK Push',
        error: axiosError.message,
        mpesaError: axiosError.response?.data,
      });
    }
  }

  async stkQuery(req: Request, res: Response): Promise<Response> {
    try {
      const { checkoutRequestID } = req.body as { checkoutRequestID?: string };

      if (!checkoutRequestID) {
        return res.status(400).json({
          success: false,
          message: 'checkoutRequestID is required',
        });
      }

      const result = await mpesaService.queryStkPushStatus(checkoutRequestID);

      return res.status(200).json({
        success: true,
        message: 'STK Push query complete',
        data: result,
      });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      console.error('STK Query controller error', axiosError.message, axiosError.response?.data);

      return res.status(500).json({
        success: false,
        message: 'Failed to query STK Push status',
        error: axiosError.message,
        mpesaError: axiosError.response?.data,
      });
    }
  }

  async stkCallback(req: Request, res: Response): Promise<void> {
    try {
      console.log('STK Push callback received', JSON.stringify(req.body, null, 2));

      // Always respond 200 immediately so Safaricom does not retry
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

      setImmediate(async () => {
        try {
          await mpesaService.handleStkCallback(req.body as Record<string, unknown>);
        } catch (error) {
          console.error('Failed to process STK callback', error);
        }
      });
    } catch (error) {
      console.error('STK callback handler error', error);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    }
  }

  async getStkRequests(req: Request, res: Response): Promise<Response> {
    try {
      const limitRaw = parseInt((req.query['limit'] as string) ?? '50', 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
      const requests = await mpesaService.getStkPushRequests(limit);

      return res.status(200).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      console.error('Get STK requests controller error', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch STK Push requests',
        error: (error as Error).message,
      });
    }
  }

  async getStkRequest(req: Request, res: Response): Promise<Response> {
    try {
      const { checkoutRequestID } = req.params as { checkoutRequestID?: string };

      if (!checkoutRequestID) {
        return res.status(400).json({ success: false, message: 'checkoutRequestID is required' });
      }

      const record = await mpesaService.getStkPushRequest(checkoutRequestID);

      if (!record) {
        return res.status(404).json({ success: false, message: 'STK Push request not found' });
      }

      return res.status(200).json({ success: true, data: record });
    } catch (error) {
      console.error('Get STK request controller error', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch STK Push request',
        error: (error as Error).message,
      });
    }
  }
}

export default new MpesaController();

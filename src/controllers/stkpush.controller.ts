import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import stkPushService from '../services/stkpush.service';

class StkPushController {
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

      const result = await stkPushService.initiateStkPush(
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

      const result = await stkPushService.queryStkPushStatus(checkoutRequestID);

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
          await stkPushService.handleStkCallback(req.body as Record<string, unknown>);
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
      const requests = await stkPushService.getStkPushRequests(limit);

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

      const record = await stkPushService.getStkPushRequest(checkoutRequestID);

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

export default new StkPushController();

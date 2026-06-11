import axios, { AxiosError } from 'axios';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import mpesaConfig from '../config/mpesa';
import authService from './auth.service';
import { createLogger } from '../lib/logger';

const log = createLogger('stkpush');

type InputJsonValue = Prisma.InputJsonValue;

class StkPushService {
  generateTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }

  async initiateStkPush(
    phoneNumber: string,
    amount: number,
    accountRef: string,
    description = 'Payment',
  ): Promise<unknown> {
    try {
      const token = await authService.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = mpesaConfig.generateStkPassword(timestamp);
      const { stkCallback } = mpesaConfig.getCallbackURLs();
      const shortcode = mpesaConfig.shortcode;

      const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: stkCallback,
        AccountReference: accountRef.substring(0, 12),
        TransactionDesc: description.substring(0, 13),
      };

      log.info({ shortcode, phoneNumber, amount, accountRef, timestamp }, 'Initiating STK Push');

      const response = await axios.post<{
        MerchantRequestID: string;
        CheckoutRequestID: string;
        ResponseCode: string;
        ResponseDescription: string;
        CustomerMessage: string;
      }>(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.stkPush}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      log.info({ data: response.data }, 'STK Push initiated');

      // Persist the request for later reconciliation via stkQuery
      await prisma.stkPushRequest.create({
        data: {
          merchantRequestID: response.data.MerchantRequestID,
          checkoutRequestID: response.data.CheckoutRequestID,
          phoneNumber,
          amount,
          accountRef: accountRef.substring(0, 12),
          description: description.substring(0, 13),
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
          customerMessage: response.data.CustomerMessage,
        },
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      log.error({ err: axiosError, mpesaError: axiosError.response?.data }, 'Failed to initiate STK Push');
      throw error;
    }
  }

  async queryStkPushStatus(checkoutRequestID: string): Promise<unknown> {
    try {
      const token = await authService.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = mpesaConfig.generateStkPassword(timestamp);
      const shortcode = mpesaConfig.shortcode;

      const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID,
      };

      log.info({ checkoutRequestID }, 'Querying STK Push status');

      const response = await axios.post<Record<string, unknown>>(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.stkQuery}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      log.info({ data: response.data }, 'STK Push query response');
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      log.error({ err: axiosError, mpesaError: axiosError.response?.data }, 'Failed to query STK Push status');
      throw error;
    }
  }

  async handleStkCallback(callbackBody: Record<string, unknown>): Promise<void> {
    try {
      const body = callbackBody['Body'] as Record<string, unknown> | undefined;
      const stkCallback = body?.['stkCallback'] as Record<string, unknown> | undefined;

      if (!stkCallback) {
        log.error({ callbackBody }, 'Invalid STK callback structure');
        return;
      }

      const merchantRequestID = stkCallback['MerchantRequestID'] as string;
      const checkoutRequestID = stkCallback['CheckoutRequestID'] as string;
      const resultCode = stkCallback['ResultCode'] as number;
      const resultDesc = stkCallback['ResultDesc'] as string;

      log.info({ merchantRequestID, checkoutRequestID, resultCode }, 'STK callback received');

      // Extract payment metadata when successful (ResultCode === 0)
      let mpesaReceiptNumber: string | undefined;
      let transactionDate: string | undefined;
      let phoneNumber: string | undefined;

      if (resultCode === 0) {
        const items = (
          stkCallback['CallbackMetadata'] as Record<string, unknown>
        )?.['Item'] as Array<{ Name: string; Value: unknown }> | undefined;

        const find = (name: string) =>
          items?.find((i) => i.Name === name)?.Value as string | undefined;

        mpesaReceiptNumber = find('MpesaReceiptNumber');
        transactionDate = find('TransactionDate')?.toString();
        phoneNumber = find('PhoneNumber')?.toString();
      }

      const updated = await prisma.stkPushRequest.updateMany({
        where: { checkoutRequestID, merchantRequestID },
        data: {
          resultCode,
          resultDesc,
          mpesaReceiptNumber: mpesaReceiptNumber ?? null,
          transactionDate: transactionDate ?? null,
          callbackPhoneNumber: phoneNumber ?? null,
          rawCallback: callbackBody as unknown as InputJsonValue,
          callbackReceivedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        log.warn(
          { checkoutRequestID, merchantRequestID },
          'STK callback matched no records — possible spoofed or duplicate callback',
        );
        return;
      }

      if (resultCode === 0) {
        log.info({ mpesaReceiptNumber }, 'STK Push successful');
      } else {
        log.warn({ resultCode, resultDesc }, 'STK Push failed');
      }
    } catch (error) {
      log.error({ err: error }, 'Failed to handle STK callback');
      throw error;
    }
  }

  async getStkPushRequests(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    return prisma.stkPushRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async getStkPushRequest(checkoutRequestID: string) {
    return prisma.stkPushRequest.findUnique({ where: { checkoutRequestID } });
  }
}

export default new StkPushService();

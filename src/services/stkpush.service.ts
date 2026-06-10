import axios, { AxiosError } from 'axios';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import mpesaConfig from '../config/mpesa';
import authService from './auth.service';

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

      console.log('Initiating STK Push', { shortcode, phoneNumber, amount, accountRef, timestamp });

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

      console.log('STK Push initiated', response.data);

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
      console.error('Failed to initiate STK Push', axiosError.message, axiosError.response?.data);
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

      console.log('Querying STK Push status', checkoutRequestID);

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

      console.log('STK Push query response', response.data);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      console.error('Failed to query STK Push status', axiosError.message, axiosError.response?.data);
      throw error;
    }
  }

  async handleStkCallback(callbackBody: Record<string, unknown>): Promise<void> {
    try {
      const body = callbackBody['Body'] as Record<string, unknown> | undefined;
      const stkCallback = body?.['stkCallback'] as Record<string, unknown> | undefined;

      if (!stkCallback) {
        console.error('Invalid STK callback structure', callbackBody);
        return;
      }

      const merchantRequestID = stkCallback['MerchantRequestID'] as string;
      const checkoutRequestID = stkCallback['CheckoutRequestID'] as string;
      const resultCode = stkCallback['ResultCode'] as number;
      const resultDesc = stkCallback['ResultDesc'] as string;

      console.log('STK callback received', { merchantRequestID, checkoutRequestID, resultCode });

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
        console.warn(
          'STK callback matched no records — possible spoofed or duplicate callback',
          { checkoutRequestID, merchantRequestID },
        );
        return;
      }

      console.log(
        resultCode === 0
          ? `STK Push successful — receipt: ${mpesaReceiptNumber}`
          : `STK Push failed — ${resultDesc}`,
      );
    } catch (error) {
      console.error('Failed to handle STK callback', error);
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

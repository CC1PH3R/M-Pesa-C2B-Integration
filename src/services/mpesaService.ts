import axios, { AxiosError } from 'axios';
import { Prisma, PrismaClient } from '@prisma/client';
import mpesaConfig from '../config/mpesa';

type InputJsonValue = Prisma.InputJsonValue;

const prisma = new PrismaClient();

export interface C2BCallbackData {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber?: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  MSISDN: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  [key: string]: unknown;
}

class MpesaService {
  async getAccessToken(): Promise<string> {
    try {
      const bufferTime = new Date(Date.now() + 5 * 60 * 1000);

      const cachedToken = await prisma.accessToken.findFirst({
        where: {
          expiresAt: {
            gt: bufferTime,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (cachedToken) {
        const timeRemaining = Math.floor(
          (cachedToken.expiresAt.getTime() - Date.now()) / 1000,
        );
        console.log('Using cached access token', cachedToken.expiresAt.toISOString(), `${timeRemaining}s remaining`);
        return cachedToken.token;
      }

      console.log('Generating new access token');

      await prisma.accessToken.deleteMany({});

      const auth = Buffer.from(
        `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`,
      ).toString('base64');

      console.log('Making auth request', `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`);

      const response = await axios.get<{ access_token: string; expires_in: number }>(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      console.log('Auth response received', response.status, `expires_in=${response.data.expires_in}`);

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('No access token in response');
      }

      const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000);

      await prisma.accessToken.create({
        data: {
          token: access_token,
          expiresAt,
        },
      });

      console.log('Access token generated and cached, expires at', expiresAt.toISOString());

      return access_token;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Failed to get access token', axiosError.message, axiosError.response?.data);
      throw new Error(`M-Pesa auth failed: ${axiosError.message}`);
    }
  }

  async registerC2BUrls(): Promise<unknown> {
    try {
      const token = await this.getAccessToken();
      console.log('Access token obtained for C2B v2 registration');

      const { confirmation } = mpesaConfig.getCallbackURLs();

      const blockedKeywords = ['mpesa', 'safaricom', 'money', 'pay', 'payment'];
      const urlLower = confirmation.toLowerCase();
      const foundKeyword = blockedKeywords.find((keyword) =>
        urlLower.includes(keyword),
      );

      if (foundKeyword) {
        throw new Error(
          `Callback URL contains blocked keyword '${foundKeyword}'. ` +
            `Daraja C2B v2 rejects URLs with: ${blockedKeywords.join(', ')}`,
        );
      }

      const payload = {
        ShortCode: mpesaConfig.shortcode,
        ResponseType: mpesaConfig.responseType,
        ConfirmationURL: confirmation,
        ValidationURL: confirmation,
      };

      console.log('Attempting C2B v2 URL registration', payload.ShortCode, payload.ConfirmationURL);

      const url = `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bRegister}`;
      console.log('Calling M-Pesa C2B v2 API', url);

      const response = await axios.post<Record<string, unknown>>(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log('M-Pesa C2B v2 response received', response.status, response.data);

      const responseData = response.data;
      const success =
        responseData['ResponseCode'] === '0' ||
        (responseData['ResponseDescription'] as string)
          ?.toLowerCase()
          .includes('success');

      await prisma.urlRegistration.create({
        data: {
          shortCode: mpesaConfig.shortcode ?? '',
          responseType: mpesaConfig.responseType,
          confirmationURL: confirmation,
          validationURL: confirmation,
          success: success ?? false,
          response: responseData as unknown as Record<string, never>,
        },
      });

      if (success) {
        console.log('C2B v2 URLs registered successfully');
      } else {
        console.warn('C2B v2 registration completed but may have issues', responseData);
      }

      return responseData;
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      console.error('Failed to register C2B v2 URLs', axiosError.message, axiosError.response?.data);

      try {
        const { confirmation } = mpesaConfig.getCallbackURLs();
        await prisma.urlRegistration.create({
          data: {
            shortCode: mpesaConfig.shortcode ?? '',
            responseType: mpesaConfig.responseType,
            confirmationURL: confirmation,
            validationURL: confirmation,
            success: false,
            response: {
              error: axiosError.message,
              mpesaError: axiosError.response?.data ?? null,
              statusCode: axiosError.response?.status ?? null,
            } as unknown as Record<string, never>,
          },
        });
      } catch (dbError) {
        console.error('Failed to log registration error', dbError);
      }

      throw error;
    }
  }

  async saveConfirmation(callbackData: C2BCallbackData) {
    try {
      const transaction = await prisma.transaction.create({
        data: {
          transactionType: callbackData.TransactionType,
          transID: callbackData.TransID,
          transTime: callbackData.TransTime,
          transAmount: parseFloat(callbackData.TransAmount),
          businessShortCode: callbackData.BusinessShortCode,
          billRefNumber: callbackData.BillRefNumber ?? null,
          invoiceNumber: callbackData.InvoiceNumber ?? null,
          msisdn: callbackData.MSISDN,
          firstName: callbackData.FirstName ?? null,
          middleName: callbackData.MiddleName ?? null,
          lastName: callbackData.LastName ?? null,
          orgAccountBalance: callbackData.OrgAccountBalance
            ? parseFloat(callbackData.OrgAccountBalance)
            : null,
          rawCallback: callbackData as object,
          processed: true,
        },
      });

      console.log('Transaction saved successfully', transaction.id, transaction.transID);

      return transaction;
    } catch (error) {
      console.error('Failed to save transaction', error);

      try {
        await prisma.transaction.create({
          data: {
            transactionType: callbackData.TransactionType ?? 'Unknown',
            transID: callbackData.TransID ?? `error-${Date.now()}`,
            transTime: callbackData.TransTime ?? new Date().toISOString(),
            transAmount: parseFloat(callbackData.TransAmount ?? '0'),
            businessShortCode: callbackData.BusinessShortCode ?? '',
            msisdn: callbackData.MSISDN ?? '',
            rawCallback: callbackData as object,
            processed: false,
            processingError: (error as Error).message,
          },
        });
      } catch (saveError) {
        console.error('Failed to save error transaction', saveError);
      }

      throw error;
    }
  }

  async getAllTransactions(limit = 50) {
    try {
      return await prisma.transaction.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      console.error('Failed to fetch transactions', error);
      throw error;
    }
  }

  async getTransactionByTransID(transID: string) {
    try {
      return await prisma.transaction.findUnique({
        where: { transID },
      });
    } catch (error) {
      console.error('Failed to fetch transaction', error);
      throw error;
    }
  }

  async simulateC2B(
    amount: string | number,
    msisdn: string,
    billRefNumber = 'TestAccount',
  ): Promise<unknown> {
    try {
      const token = await this.getAccessToken();

      const payload = {
        ShortCode: mpesaConfig.shortcode,
        CommandID: 'CustomerPayBillOnline',
        Amount: amount,
        Msisdn: msisdn,
        BillRefNumber: billRefNumber,
      };

      console.log('Simulating C2B payment', payload);

      const response = await axios.post<unknown>(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bSimulate}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('C2B simulation response', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to simulate C2B', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // STK Push (Lipa Na M-Pesa Online / M-Pesa Express)
  // ─────────────────────────────────────────────

  /**
   * Returns the current timestamp in the format required by Daraja: YYYYMMDDHHmmss
   * This is computed fresh for every request — the Password is derived from it.
   */
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

  /**
   * Initiates an STK Push (customer-triggered payment prompt on phone).
   *
   * @param phoneNumber  Customer phone in format 2547XXXXXXXX
   * @param amount       Amount in KES (whole number)
   * @param accountRef   Account reference shown to customer (max 12 chars)
   * @param description  Transaction description (max 13 chars)
   */
  async initiateStkPush(
    phoneNumber: string,
    amount: number,
    accountRef: string,
    description = 'Payment',
  ): Promise<unknown> {
    try {
      const token = await this.getAccessToken();
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
        PartyA: phoneNumber,         // Customer phone
        PartyB: shortcode,           // Same as BusinessShortCode for PayBill
        PhoneNumber: phoneNumber,    // Phone that receives the STK prompt
        CallBackURL: stkCallback,
        AccountReference: accountRef.substring(0, 12),
        TransactionDesc: description.substring(0, 13),
      };

      console.log('Initiating STK Push', {
        shortcode,
        phoneNumber,
        amount,
        accountRef,
        timestamp,
      });

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

  /**
   * Queries the status of a previously initiated STK Push request.
   * Use this after ~10 seconds if you have not yet received the callback.
   */
  async queryStkPushStatus(checkoutRequestID: string): Promise<unknown> {
    try {
      const token = await this.getAccessToken();
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

  /**
   * Handles the async STK Push callback from Safaricom and updates the DB record.
   */
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
    return prisma.stkPushRequest.findUnique({
      where: { checkoutRequestID },
    });
  }
}

export default new MpesaService();

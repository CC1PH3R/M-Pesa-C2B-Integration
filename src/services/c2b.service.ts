import axios, { AxiosError } from 'axios';
import prisma from '../lib/prisma';
import mpesaConfig from '../config/mpesa';
import authService from './auth.service';

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

class C2BService {
  async registerC2BUrls(): Promise<unknown> {
    try {
      const token = await authService.getAccessToken();
      console.log('Access token obtained for C2B v2 registration');

      const { confirmation } = mpesaConfig.getCallbackURLs();

      const blockedKeywords = ['mpesa', 'safaricom', 'money', 'pay', 'payment'];
      const urlLower = confirmation.toLowerCase();
      const foundKeyword = blockedKeywords.find((keyword) => urlLower.includes(keyword));

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
        (responseData['ResponseDescription'] as string)?.toLowerCase().includes('success');

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
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      console.error('Failed to fetch transactions', error);
      throw error;
    }
  }

  async getTransactionByTransID(transID: string) {
    try {
      return await prisma.transaction.findUnique({ where: { transID } });
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
      const token = await authService.getAccessToken();

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
}

export default new C2BService();

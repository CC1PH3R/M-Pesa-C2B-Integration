"use strict";
/**
 * M-Pesa Service - Handles all M-Pesa API interactions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const mpesa_1 = __importDefault(require("../config/mpesa"));
const logger_1 = __importDefault(require("../utils/logger"));
const prisma = new client_1.PrismaClient();
class MpesaService {
    /**
     * Generate M-Pesa access token with caching
     */
    async getAccessToken() {
        try {
            // Add 5 minute buffer to ensure token is valid
            const bufferTime = new Date(Date.now() + 5 * 60 * 1000);
            // Check if we have a valid cached token
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
                const timeRemaining = Math.floor((cachedToken.expiresAt.getTime() - Date.now()) / 1000);
                logger_1.default.info('Using cached access token', {
                    expiresAt: cachedToken.expiresAt.toISOString(),
                    secondsRemaining: timeRemaining,
                });
                return cachedToken.token;
            }
            logger_1.default.info('Generating new access token');
            // Clear old tokens first
            await prisma.accessToken.deleteMany({});
            // Generate new token
            const auth = Buffer.from(`${mpesa_1.default.consumerKey}:${mpesa_1.default.consumerSecret}`).toString('base64');
            logger_1.default.info('Making auth request', {
                url: `${mpesa_1.default.baseURL}${mpesa_1.default.endpoints.auth}`,
                consumerKeyLength: mpesa_1.default.consumerKey?.length,
                consumerSecretLength: mpesa_1.default.consumerSecret?.length,
            });
            const response = await axios_1.default.get(`${mpesa_1.default.baseURL}${mpesa_1.default.endpoints.auth}`, {
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            logger_1.default.info('Auth response received', {
                status: response.status,
                hasAccessToken: !!response.data.access_token,
                expiresIn: response.data.expires_in,
            });
            const { access_token, expires_in } = response.data;
            if (!access_token) {
                throw new Error('No access token in response');
            }
            // Cache the token with 5 minute buffer (expires_in is in seconds)
            const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000);
            await prisma.accessToken.create({
                data: {
                    token: access_token,
                    expiresAt,
                },
            });
            logger_1.default.info('Access token generated and cached', {
                expiresAt: expiresAt.toISOString(),
                expiresInSeconds: expires_in,
                tokenLength: access_token.length,
            });
            return access_token;
        }
        catch (error) {
            const err = error;
            logger_1.default.error('Failed to get access token', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
                config: {
                    url: err.config?.url,
                    headers: err.config?.headers,
                },
            });
            throw new Error(`M-Pesa auth failed: ${err.message}`);
        }
    }
    /**
     * Register C2B URLs with M-Pesa (v2 API)
     */
    async registerC2BUrls() {
        try {
            const token = await this.getAccessToken();
            logger_1.default.info('Access token obtained for C2B v2 registration');
            const { confirmation } = mpesa_1.default.getCallbackURLs();
            // Validate URL doesn't contain blocked keywords
            const blockedKeywords = ['mpesa', 'safaricom', 'money', 'pay', 'payment'];
            const urlLower = confirmation.toLowerCase();
            const foundKeyword = blockedKeywords.find((keyword) => urlLower.includes(keyword));
            if (foundKeyword) {
                throw new Error(`Callback URL contains blocked keyword '${foundKeyword}'. ` +
                    `Daraja C2B v2 rejects URLs with: ${blockedKeywords.join(', ')}`);
            }
            const payload = {
                ShortCode: mpesa_1.default.shortcode,
                ResponseType: mpesa_1.default.responseType,
                ConfirmationURL: confirmation,
                ValidationURL: confirmation,
            };
            logger_1.default.info('Attempting C2B v2 URL registration', {
                shortCode: payload.ShortCode,
                confirmationURL: payload.ConfirmationURL,
                responseType: payload.ResponseType,
                apiVersion: 'v2',
            });
            const url = `${mpesa_1.default.baseURL}${mpesa_1.default.endpoints.c2bRegister}`;
            logger_1.default.info('Calling M-Pesa C2B v2 API', { url });
            const response = await axios_1.default.post(url, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            logger_1.default.info('M-Pesa C2B v2 response received', {
                status: response.status,
                data: response.data,
            });
            const success = response.data.ResponseCode === '0' ||
                response.data.ResponseDescription?.toLowerCase().includes('success');
            await prisma.urlRegistration.create({
                data: {
                    shortCode: mpesa_1.default.shortcode ?? '',
                    responseType: mpesa_1.default.responseType,
                    confirmationURL: confirmation,
                    validationURL: confirmation,
                    success: success ?? false,
                    response: response.data,
                },
            });
            if (success) {
                logger_1.default.info('C2B v2 URLs registered successfully');
            }
            else {
                logger_1.default.warn('C2B v2 registration completed but may have issues', response.data);
            }
            return response.data;
        }
        catch (error) {
            const err = error;
            const errorDetails = {
                message: err.message,
                code: err.code,
                status: err.response?.status,
                statusText: err.response?.statusText,
                errorCode: err.response?.data?.errorCode,
                errorMessage: err.response?.data?.errorMessage,
                data: err.response?.data,
                config: {
                    url: err.config?.url,
                    method: err.config?.method,
                },
            };
            logger_1.default.error('Failed to register C2B v2 URLs', errorDetails);
            try {
                const { confirmation } = mpesa_1.default.getCallbackURLs();
                await prisma.urlRegistration.create({
                    data: {
                        shortCode: mpesa_1.default.shortcode ?? '',
                        responseType: mpesa_1.default.responseType,
                        confirmationURL: confirmation,
                        validationURL: confirmation,
                        success: false,
                        response: {
                            error: err.message,
                            mpesaError: err.response?.data,
                            statusCode: err.response?.status,
                        },
                    },
                });
            }
            catch (dbError) {
                logger_1.default.error('Failed to log registration error', dbError);
            }
            throw error;
        }
    }
    /**
     * Save C2B confirmation callback to database
     */
    async saveConfirmation(callbackData) {
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
                    rawCallback: callbackData,
                    processed: true,
                },
            });
            logger_1.default.info('Transaction saved successfully', {
                id: transaction.id,
                transID: transaction.transID,
                amount: transaction.transAmount.toString(),
            });
            return transaction;
        }
        catch (error) {
            logger_1.default.error('Failed to save transaction', error);
            try {
                await prisma.transaction.create({
                    data: {
                        transactionType: callbackData.TransactionType ?? 'Unknown',
                        transID: callbackData.TransID ?? `error-${Date.now()}`,
                        transTime: callbackData.TransTime ?? new Date().toISOString(),
                        transAmount: parseFloat(callbackData.TransAmount ?? '0'),
                        businessShortCode: callbackData.BusinessShortCode ?? '',
                        msisdn: callbackData.MSISDN ?? '',
                        rawCallback: callbackData,
                        processed: false,
                        processingError: error.message,
                    },
                });
            }
            catch (saveError) {
                logger_1.default.error('Failed to save error transaction', saveError);
            }
            throw error;
        }
    }
    /**
     * Get all transactions
     */
    async getAllTransactions(limit = 50) {
        try {
            return await prisma.transaction.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to fetch transactions', error);
            throw error;
        }
    }
    /**
     * Get transaction by M-Pesa TransID
     */
    async getTransactionByTransID(transID) {
        try {
            return await prisma.transaction.findUnique({
                where: { transID },
            });
        }
        catch (error) {
            logger_1.default.error('Failed to fetch transaction', error);
            throw error;
        }
    }
    /**
     * Simulate C2B Payment (for testing only)
     */
    async simulateC2B(amount, msisdn, billRefNumber = 'TestAccount') {
        try {
            const token = await this.getAccessToken();
            const payload = {
                ShortCode: mpesa_1.default.shortcode,
                CommandID: 'CustomerPayBillOnline',
                Amount: amount,
                Msisdn: msisdn,
                BillRefNumber: billRefNumber,
            };
            logger_1.default.info('Simulating C2B payment', payload);
            const response = await axios_1.default.post(`${mpesa_1.default.baseURL}${mpesa_1.default.endpoints.c2bSimulate}`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            logger_1.default.info('C2B simulation response', response.data);
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to simulate C2B', error);
            throw error;
        }
    }
}
exports.default = new MpesaService();

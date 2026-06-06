"use strict";
/**
 * M-Pesa Controller - Handles HTTP requests and responses
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const mpesaService_1 = __importDefault(require("../services/mpesaService"));
const mpesa_1 = __importDefault(require("../config/mpesa"));
const logger_1 = __importDefault(require("../utils/logger"));
class MpesaController {
    /**
     * Register C2B URLs
     */
    async registerUrls(req, res) {
        try {
            logger_1.default.info('Register URLs endpoint called', {
                method: req.method,
                url: req.url,
            });
            const result = await mpesaService_1.default.registerC2BUrls();
            return res.status(200).json({
                success: true,
                message: 'C2B URLs registered successfully',
                data: result,
            });
        }
        catch (error) {
            const err = error;
            logger_1.default.error('Register URLs controller error', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
            });
            return res.status(500).json({
                success: false,
                message: 'Failed to register C2B URLs',
                error: err.message,
                mpesaError: err.response?.data,
                hint: 'Check logs for detailed error information',
            });
        }
    }
    /**
     * C2B Confirmation callback
     * M-Pesa calls this to confirm a successful payment
     */
    async confirmation(req, res) {
        try {
            logger_1.default.info('Confirmation callback received', req.body);
            // Respond immediately to M-Pesa (must be within 30 seconds)
            res.status(200).json({
                ResultCode: 0,
                ResultDesc: 'Success',
            });
            // Process the transaction asynchronously
            setImmediate(async () => {
                try {
                    await mpesaService_1.default.saveConfirmation(req.body);
                    logger_1.default.info('Transaction processed successfully');
                }
                catch (error) {
                    logger_1.default.error('Failed to process confirmation', error);
                }
            });
        }
        catch (error) {
            logger_1.default.error('Confirmation callback error', error);
            // Still return success to M-Pesa
            res.status(200).json({
                ResultCode: 0,
                ResultDesc: 'Success',
            });
        }
    }
    /**
     * Get all transactions
     */
    async getTransactions(req, res) {
        try {
            const limit = parseInt(req.query.limit ?? '50') || 50;
            const transactions = await mpesaService_1.default.getAllTransactions(limit);
            return res.status(200).json({
                success: true,
                count: transactions.length,
                data: transactions,
            });
        }
        catch (error) {
            logger_1.default.error('Get transactions controller error', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch transactions',
                error: error.message,
            });
        }
    }
    /**
     * Get single transaction by TransID
     */
    async getTransaction(req, res) {
        try {
            const { transID } = req.params;
            const transaction = await mpesaService_1.default.getTransactionByTransID(transID);
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
        }
        catch (error) {
            logger_1.default.error('Get transaction controller error', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch transaction',
                error: error.message,
            });
        }
    }
    /**
     * Simulate C2B payment (testing only)
     */
    async simulate(req, res) {
        try {
            const { amount, msisdn, billRefNumber } = req.body;
            if (!amount || !msisdn) {
                return res.status(400).json({
                    success: false,
                    message: 'Amount and msisdn are required',
                });
            }
            const result = await mpesaService_1.default.simulateC2B(amount, msisdn, billRefNumber);
            return res.status(200).json({
                success: true,
                message: 'Payment simulation sent',
                data: result,
            });
        }
        catch (error) {
            logger_1.default.error('Simulate payment controller error', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to simulate payment',
                error: error.message,
            });
        }
    }
    /**
     * Test access token generation and validity (C2B v2)
     */
    async testAuth(req, res) {
        try {
            logger_1.default.info('Testing authentication with C2B v2');
            const prisma = new client_1.PrismaClient();
            // Clear cached tokens
            await prisma.accessToken.deleteMany({});
            logger_1.default.info('Cleared cached tokens');
            // Generate fresh token
            const token = await mpesaService_1.default.getAccessToken();
            try {
                const testResponse = await axios_1.default.post(`${mpesa_1.default.baseURL}${mpesa_1.default.endpoints.c2bRegister}`, {
                    ShortCode: mpesa_1.default.shortcode,
                    ResponseType: mpesa_1.default.responseType,
                    ConfirmationURL: `${mpesa_1.default.appBaseURL}/api/ganji/confirmation`,
                    ValidationURL: `${mpesa_1.default.appBaseURL}/api/ganji/confirmation`,
                }, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                });
                return res.status(200).json({
                    success: true,
                    message: 'Token is valid and C2B v2 registration successful',
                    apiVersion: 'v2',
                    tokenInfo: {
                        length: token.length,
                        prefix: token.substring(0, 20) + '...',
                    },
                    mpesaResponse: testResponse.data,
                });
            }
            catch (apiError) {
                const err = apiError;
                return res.status(200).json({
                    success: false,
                    message: 'Token generated but C2B v2 API call failed',
                    apiVersion: 'v2',
                    tokenInfo: {
                        length: token.length,
                        prefix: token.substring(0, 20) + '...',
                    },
                    error: {
                        status: err.response?.status,
                        code: err.response?.data?.errorCode,
                        message: err.response?.data?.errorMessage,
                        fullError: err.response?.data,
                    },
                });
            }
        }
        catch (error) {
            logger_1.default.error('Test auth failed', error);
            const err = error;
            return res.status(500).json({
                success: false,
                message: 'Authentication test failed',
                error: err.message,
                details: err.response?.data,
            });
        }
    }
    /**
     * Health check endpoint
     */
    async health(_req, res) {
        return res.status(200).json({
            success: true,
            message: 'M-Pesa C2B API is running',
            timestamp: new Date().toISOString(),
        });
    }
}
exports.default = new MpesaController();

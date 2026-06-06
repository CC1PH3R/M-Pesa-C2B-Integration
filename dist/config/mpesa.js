"use strict";
/**
 * M-Pesa Daraja API Configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mpesaConfig = {
    // API Credentials (trim whitespace)
    consumerKey: process.env.MPESA_CONSUMER_KEY?.trim(),
    consumerSecret: process.env.MPESA_CONSUMER_SECRET?.trim(),
    shortcode: process.env.MPESA_SHORTCODE?.trim(),
    passkey: process.env.MPESA_PASSKEY?.trim(),
    // API URLs
    baseURL: process.env.MPESA_BASE_URL ?? 'https://api.safaricom.co.ke',
    // Application URLs
    appBaseURL: process.env.APP_BASE_URL,
    // Response Type (Completed or Cancelled)
    responseType: process.env.MPESA_RESPONSE_TYPE ?? 'Completed',
    // API Endpoints
    endpoints: {
        auth: '/oauth/v1/generate?grant_type=client_credentials',
        c2bRegister: '/mpesa/c2b/v2/registerurl', // v2 required for production shortcodes
        c2bSimulate: '/mpesa/c2b/v1/simulate', // For testing (still v1)
    },
    // Callback URLs
    getCallbackURLs() {
        return {
            confirmation: `${this.appBaseURL}/api/ganji/confirmation`,
        };
    },
    // Validate configuration
    validate() {
        const required = ['consumerKey', 'consumerSecret', 'shortcode', 'appBaseURL'];
        const missing = required.filter((key) => !this[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required M-Pesa config: ${missing.join(', ')}`);
        }
        return true;
    },
};
exports.default = mpesaConfig;

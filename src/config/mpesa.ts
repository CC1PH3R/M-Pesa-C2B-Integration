/**
 * M-Pesa Daraja API Configuration
 */

import 'dotenv/config';

interface MpesaEndpoints {
  auth: string;
  c2bRegister: string;
  c2bSimulate: string;
}

interface CallbackURLs {
  confirmation: string;
}

interface MpesaConfig {
  consumerKey: string | undefined;
  consumerSecret: string | undefined;
  shortcode: string | undefined;
  passkey: string | undefined;
  baseURL: string;
  appBaseURL: string | undefined;
  responseType: string;
  endpoints: MpesaEndpoints;
  getCallbackURLs(): CallbackURLs;
  validate(): true;
}

const mpesaConfig: MpesaConfig = {
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
  getCallbackURLs(): CallbackURLs {
    return {
      confirmation: `${this.appBaseURL}/api/ganji/confirmation`,
    };
  },

  // Validate configuration
  validate(): true {
    const required = ['consumerKey', 'consumerSecret', 'shortcode', 'appBaseURL'] as const;

    const missing = required.filter((key) => !this[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required M-Pesa config: ${missing.join(', ')}`);
    }

    return true;
  },
};

export default mpesaConfig;

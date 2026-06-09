import dotenv from 'dotenv';
dotenv.config();

export interface CallbackURLs {
  confirmation: string;
  stkCallback: string;
}

interface MpesaEndpoints {
  auth: string;
  c2bRegister: string;
  c2bSimulate: string;
  stkPush: string;
  stkQuery: string;
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
  generateStkPassword(timestamp: string): string;
  validate(): boolean;
}

const mpesaConfig: MpesaConfig = {
  consumerKey: process.env.MPESA_CONSUMER_KEY?.trim(),
  consumerSecret: process.env.MPESA_CONSUMER_SECRET?.trim(),
  shortcode: process.env.MPESA_SHORTCODE?.trim(),
  passkey: process.env.MPESA_PASSKEY?.trim(),

  baseURL: process.env.MPESA_BASE_URL ?? 'https://api.safaricom.co.ke',
  appBaseURL: process.env.APP_BASE_URL,
  responseType: process.env.MPESA_RESPONSE_TYPE ?? 'Completed',

  endpoints: {
    auth: '/oauth/v1/generate?grant_type=client_credentials',
    c2bRegister: '/mpesa/c2b/v2/registerurl',
    c2bSimulate: '/mpesa/c2b/v1/simulate',
    stkPush: '/mpesa/stkpush/v1/processrequest',
    stkQuery: '/mpesa/stkpushquery/v1/query',
  },

  getCallbackURLs(): CallbackURLs {
    return {
      confirmation: `${this.appBaseURL}/api/ganji/confirmation`,
      stkCallback: `${this.appBaseURL}/api/ganji/stk/callback`,
    };
  },

  /**
   * Generates the STK Push password dynamically for a given timestamp.
   *
   * Formula (per Safaricom Daraja docs):
   *   Password = base64( Shortcode + Passkey + Timestamp )
   *
   * This MUST be re-generated on every request using the current timestamp —
   * it is never static or pre-stored.
   */
  generateStkPassword(timestamp: string): string {
    const passkey = this.passkey ?? '';
    return Buffer.from(`${this.shortcode ?? ''}${passkey}${timestamp}`).toString('base64');
  },

  validate(): boolean {
    const required = ['consumerKey', 'consumerSecret', 'shortcode', 'passkey', 'appBaseURL'];
    const self = this as unknown as Record<string, unknown>;
    const missing = required.filter((key) => !self[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required M-Pesa config: ${missing.join(', ')}`);
    }

    return true;
  },
};

export default mpesaConfig;

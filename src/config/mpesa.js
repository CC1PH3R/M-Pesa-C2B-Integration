/**
 * M-Pesa Daraja API Configuration
 */

require('dotenv').config();

const mpesaConfig = {
  // API Credentials (trim whitespace)
  consumerKey: process.env.MPESA_CONSUMER_KEY?.trim(),
  consumerSecret: process.env.MPESA_CONSUMER_SECRET?.trim(),
  shortcode: process.env.MPESA_SHORTCODE?.trim(),
  passkey: process.env.MPESA_PASSKEY?.trim(),
  
  // API URLs
  baseURL: process.env.MPESA_BASE_URL || 'https://api.safaricom.co.ke',
  
  // Application URLs
  appBaseURL: process.env.APP_BASE_URL,
  
  // Response Type (Completed or Cancelled)
  responseType: process.env.MPESA_RESPONSE_TYPE || 'Completed',
  
  // API Endpoints
  endpoints: {
    auth: '/oauth/v1/generate?grant_type=client_credentials',
    c2bRegister: '/mpesa/c2b/v1/registerurl',
    c2bSimulate: '/mpesa/c2b/v1/simulate' // For testing
  },
  
  // Callback URLs
  getCallbackURLs: function() {
    return {
      confirmation: `${this.appBaseURL}/api/mpesa/confirmation`
    };
  },
  
  // Validate configuration
  validate: function() {
    const required = [
      'consumerKey',
      'consumerSecret', 
      'shortcode',
      'appBaseURL'
    ];
    
    const missing = required.filter(key => !this[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required M-Pesa config: ${missing.join(', ')}`);
    }
    
    return true;
  }
};

module.exports = mpesaConfig;
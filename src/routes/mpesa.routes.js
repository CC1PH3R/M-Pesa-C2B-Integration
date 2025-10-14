/**
 * M-Pesa API Routes
 */

const express = require('express');
const mpesaController = require('../controllers/mpesaController');

const router = express.Router();

// Health check
router.get('/health', mpesaController.health);

// Debug credentials (remove after testing)
router.get('/debug-config', (req, res) => {
  const mpesaConfig = require('../config/mpesa');
  res.json({
    consumerKey: {
      exists: !!mpesaConfig.consumerKey,
      length: mpesaConfig.consumerKey?.length,
      first10: mpesaConfig.consumerKey?.substring(0, 10),
      last10: mpesaConfig.consumerKey?.substring(mpesaConfig.consumerKey.length - 10),
      hasWhitespace: /\s/.test(mpesaConfig.consumerKey || '')
    },
    consumerSecret: {
      exists: !!mpesaConfig.consumerSecret,
      length: mpesaConfig.consumerSecret?.length,
      first10: mpesaConfig.consumerSecret?.substring(0, 10),
      last10: mpesaConfig.consumerSecret?.substring(mpesaConfig.consumerSecret.length - 10),
      hasWhitespace: /\s/.test(mpesaConfig.consumerSecret || '')
    },
    shortcode: mpesaConfig.shortcode,
    baseURL: mpesaConfig.baseURL,
    appBaseURL: mpesaConfig.appBaseURL,
    authEndpoint: `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`,
    registerEndpoint: `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bRegister}`
  });
});

// Test authentication
router.get('/test-auth', mpesaController.testAuth);

// Register C2B URLs with M-Pesa
router.post('/register', mpesaController.registerUrls);

// M-Pesa Callbacks (these will be called by M-Pesa)
router.post('/confirmation', mpesaController.confirmation);

// Transaction management endpoints
router.get('/transactions', mpesaController.getTransactions);
router.get('/transactions/:transID', mpesaController.getTransaction);

// Simulate payment (for testing)
router.post('/simulate', mpesaController.simulate);

module.exports = router;
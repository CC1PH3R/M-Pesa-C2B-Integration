/**
 * M-Pesa API Routes
 */

const express = require('express');
const mpesaController = require('../controllers/mpesaController');

const router = express.Router();

// Health check
router.get('/health', mpesaController.health);

// Register C2B URLs with M-Pesa
router.post('/register', mpesaController.registerUrls);

// M-Pesa Callbacks (these will be called by M-Pesa)
router.post('/confirmation', mpesaController.confirmation);

// Transaction management endpoints
router.get('/transactions', mpesaController.getTransactions);
router.get('/transactions/:transID', mpesaController.getTransaction);

// Simulate payment (for testing)
router.post('/simulate', mpesaController.simulate);

// Test raw auth and registration (for debugging)
router.get('/raw-auth-test', async (req, res) => {
  const axios = require('axios');
  
  const key = process.env.MPESA_CONSUMER_KEY?.trim();
  const secret = process.env.MPESA_CONSUMER_SECRET?.trim();
  
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  
  try {
    const tokenRes = await axios.get(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: { Authorization: `Basic ${auth}` }
      }
    );
    
    const token = tokenRes.data.access_token;
    
    // Immediately try registration
    const regRes = await axios.post(
      'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl',
      {
        ShortCode: process.env.MPESA_SHORTCODE?.trim(),
        ResponseType: 'Completed',
        ConfirmationURL: `${process.env.APP_BASE_URL}/api/mpesa/confirmation`,
        ValidationURL: `${process.env.APP_BASE_URL}/api/mpesa/confirmation`
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({
      success: true,
      tokenGenerated: true,
      registrationSuccess: true,
      response: regRes.data
    });
    
  } catch (err) {
    res.json({
      success: false,
      error: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
  }
});

module.exports = router;
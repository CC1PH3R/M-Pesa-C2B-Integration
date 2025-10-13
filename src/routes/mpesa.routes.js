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
router.post('/validation', mpesaController.validation);
router.post('/confirmation', mpesaController.confirmation);

// Transaction management endpoints
router.get('/transactions', mpesaController.getTransactions);
router.get('/transactions/:transID', mpesaController.getTransaction);

// Simulate payment (for testing)
router.post('/simulate', mpesaController.simulate);

module.exports = router;
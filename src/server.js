/**
 * M-Pesa C2B Test Application Server
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mpesaRoutes = require('./routes/mpesa.routes');
const mpesaConfig = require('./config/mpesa');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Request logging
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Routes
app.use('/api/mpesa', mpesaRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'M-Pesa C2B Test API',
    version: '1.0.0',
    endpoints: {
      health: '/api/mpesa/health',
      register: 'POST /api/mpesa/register',
      transactions: 'GET /api/mpesa/transactions',
      simulate: 'POST /api/mpesa/simulate'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Validate M-Pesa configuration
    mpesaConfig.validate();
    logger.info('M-Pesa configuration validated');

    app.listen(PORT, () => {
      logger.info(`Server started successfully`, {
        port: PORT,
        environment: process.env.NODE_ENV,
        baseURL: mpesaConfig.appBaseURL
      });

      logger.info('Server ready to receive M-Pesa callbacks', {
        confirmation: mpesaConfig.getCallbackURLs().confirmation,
        validation: mpesaConfig.getCallbackURLs().validation
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();
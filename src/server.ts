/**
 * M-Pesa C2B Test Application Server
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mpesaRoutes from './routes/mpesa.routes';
import mpesaConfig from './config/mpesa';
import logger from './utils/logger';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Routes
// Using '/api/ganji' instead of '/api/mpesa' to comply with Daraja C2B URL restrictions
app.use('/api/ganji', mpesaRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'M-Pesa C2B Test API',
    version: '1.0.0',
    endpoints: {
      health: '/api/ganji/health',
      register: 'POST /api/ganji/register',
      transactions: 'GET /api/ganji/transactions',
      simulate: 'POST /api/ganji/simulate',
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Error handler
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Server error', err);

  res.status(err.status ?? 500).json({
    success: false,
    message: err.message ?? 'Internal server error',
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Validate M-Pesa configuration
    mpesaConfig.validate();
    logger.info('M-Pesa configuration validated');

    app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV,
        baseURL: mpesaConfig.appBaseURL,
      });

      logger.info('Server ready to receive M-Pesa callbacks', {
        confirmation: mpesaConfig.getCallbackURLs().confirmation,
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

startServer();

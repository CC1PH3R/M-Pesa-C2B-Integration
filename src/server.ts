import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import mpesaConfig from './config/mpesa';
import { setupSwagger } from './config/swagger';
import logger from './lib/logger';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API documentation
setupSwagger(app);

// Routes
// Using '/api/ganji' instead of '/api/mpesa' to comply with Daraja C2B URL restrictions
app.use('/api/ganji', routes);

/**
 * @openapi
 * /:
 *   get:
 *     tags: [General]
 *     summary: API root
 *     description: Returns API metadata and a quick reference of available endpoints.
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RootResponse'
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'M-Pesa C2B Test API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/ganji/health',
      testAuth: 'GET /api/ganji/test-auth',
      // C2B
      register: 'POST /api/ganji/register',
      confirmation: 'POST /api/ganji/confirmation',
      transactions: 'GET /api/ganji/transactions',
      transactionById: 'GET /api/ganji/transactions/:transID',
      simulate: 'POST /api/ganji/simulate',
      // STK Push
      stkPush: 'POST /api/ganji/stk/push',
      stkQuery: 'POST /api/ganji/stk/query',
      stkCallback: 'POST /api/ganji/stk/callback',
      stkRequests: 'GET /api/ganji/stk/requests',
      stkRequestById: 'GET /api/ganji/stk/requests/:checkoutRequestID',
      docs: 'GET /api-docs',
      openApiSpec: 'GET /api-docs.json',
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
interface HttpError extends Error {
  status?: number;
}

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Server error');

  res.status(err.status ?? 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    mpesaConfig.validate();
    logger.info('M-Pesa configuration validated');

    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV ?? 'development' }, 'Server started');
      const docsUrl = mpesaConfig.appBaseURL
        ? `${mpesaConfig.appBaseURL.replace(/\/+$/, '')}/api-docs`
        : `http://localhost:${PORT}/api-docs`;
      logger.info({ docs: docsUrl }, 'Swagger UI available');
      logger.info({ callbackURL: mpesaConfig.getCallbackURLs().confirmation }, 'Callback URL registered');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
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

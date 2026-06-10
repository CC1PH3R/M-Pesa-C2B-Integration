import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import mpesaConfig from './config/mpesa';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Routes
// Using '/api/ganji' instead of '/api/mpesa' to comply with Daraja C2B URL restrictions
app.use('/api/ganji', routes);

// Root endpoint
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
      simulate: 'POST /api/ganji/simulate',
      // STK Push
      stkPush: 'POST /api/ganji/stk/push',
      stkQuery: 'POST /api/ganji/stk/query',
      stkCallback: 'POST /api/ganji/stk/callback',
      stkRequests: 'GET /api/ganji/stk/requests',
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
  console.error('Server error', err);

  res.status(err.status ?? 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    mpesaConfig.validate();
    console.log('M-Pesa configuration validated');

    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
      console.log(`Callback URL: ${mpesaConfig.getCallbackURLs().confirmation}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

import { Router, Request, Response } from 'express';
import mpesaController from '../controllers/mpesaController';
import mpesaConfig from '../config/mpesa';

const router = Router();

// Health check
router.get('/health', (req: Request, res: Response) =>
  mpesaController.health(req, res),
);

// Debug credentials (remove after testing)
router.get('/debug-config', (_req: Request, res: Response) => {
  res.json({
    consumerKey: {
      exists: !!mpesaConfig.consumerKey,
      length: mpesaConfig.consumerKey?.length,
      first10: mpesaConfig.consumerKey?.substring(0, 10),
      last10: mpesaConfig.consumerKey?.substring(
        (mpesaConfig.consumerKey?.length ?? 0) - 10,
      ),
      hasWhitespace: /\s/.test(mpesaConfig.consumerKey ?? ''),
    },
    consumerSecret: {
      exists: !!mpesaConfig.consumerSecret,
      length: mpesaConfig.consumerSecret?.length,
      first10: mpesaConfig.consumerSecret?.substring(0, 10),
      last10: mpesaConfig.consumerSecret?.substring(
        (mpesaConfig.consumerSecret?.length ?? 0) - 10,
      ),
      hasWhitespace: /\s/.test(mpesaConfig.consumerSecret ?? ''),
    },
    shortcode: mpesaConfig.shortcode,
    baseURL: mpesaConfig.baseURL,
    appBaseURL: mpesaConfig.appBaseURL,
    authEndpoint: `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`,
    registerEndpoint: `${mpesaConfig.baseURL}${mpesaConfig.endpoints.c2bRegister}`,
  });
});

// Test authentication
router.get('/test-auth', (req: Request, res: Response) =>
  mpesaController.testAuth(req, res),
);

// Register C2B URLs with M-Pesa
router.post('/register', (req: Request, res: Response) =>
  mpesaController.registerUrls(req, res),
);

// M-Pesa Callbacks (called by M-Pesa)
router.post('/confirmation', (req: Request, res: Response) =>
  mpesaController.confirmation(req, res),
);

// Transaction management endpoints
router.get('/transactions', (req: Request, res: Response) =>
  mpesaController.getTransactions(req, res),
);
router.get('/transactions/:transID', (req: Request, res: Response) =>
  mpesaController.getTransaction(req, res),
);

// Simulate payment (for testing)
router.post('/simulate', (req: Request, res: Response) =>
  mpesaController.simulate(req, res),
);

// ─────────────────────────────────────────────
// STK Push (Lipa Na M-Pesa / M-Pesa Express)
// ─────────────────────────────────────────────

// Initiate STK Push — sends payment prompt to customer's phone
router.post('/stk/push', (req: Request, res: Response) =>
  mpesaController.stkPush(req, res),
);

// Query status of an STK Push (use ~10s after initiation if no callback yet)
router.post('/stk/query', (req: Request, res: Response) =>
  mpesaController.stkQuery(req, res),
);

// Safaricom async STK Push callback (called by M-Pesa, not by your frontend)
router.post('/stk/callback', (req: Request, res: Response) =>
  mpesaController.stkCallback(req, res),
);

// STK Push request records
router.get('/stk/requests', (req: Request, res: Response) =>
  mpesaController.getStkRequests(req, res),
);
router.get('/stk/requests/:checkoutRequestID', (req: Request, res: Response) =>
  mpesaController.getStkRequest(req, res),
);

export default router;

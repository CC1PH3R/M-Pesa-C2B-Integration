import { Router, Request, Response } from 'express';
import stkPushController from '../controllers/stkpush.controller';

const router = Router();

// Initiate STK Push — sends payment prompt to customer's phone
router.post('/stk/push', (req: Request, res: Response) =>
  stkPushController.stkPush(req, res),
);

// Query status of an STK Push (use ~10s after initiation if no callback yet)
router.post('/stk/query', (req: Request, res: Response) =>
  stkPushController.stkQuery(req, res),
);

// Safaricom async STK Push callback (called by M-Pesa)
router.post('/stk/callback', (req: Request, res: Response) =>
  stkPushController.stkCallback(req, res),
);

// STK Push request records
router.get('/stk/requests', (req: Request, res: Response) =>
  stkPushController.getStkRequests(req, res),
);
router.get('/stk/requests/:checkoutRequestID', (req: Request, res: Response) =>
  stkPushController.getStkRequest(req, res),
);

export default router;

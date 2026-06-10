import { Router, Request, Response } from 'express';
import c2bController from '../controllers/c2b.controller';

const router = Router();

// Register C2B callback URLs with M-Pesa (run once after deployment)
router.post('/register', (req: Request, res: Response) =>
  c2bController.registerUrls(req, res),
);

// M-Pesa C2B callback (called by M-Pesa)
router.post('/confirmation', (req: Request, res: Response) =>
  c2bController.confirmation(req, res),
);

// Transaction records
router.get('/transactions', (req: Request, res: Response) =>
  c2bController.getTransactions(req, res),
);
router.get('/transactions/:transID', (req: Request, res: Response) =>
  c2bController.getTransaction(req, res),
);

// Simulate a C2B payment (sandbox testing only)
router.post('/simulate', (req: Request, res: Response) =>
  c2bController.simulate(req, res),
);

export default router;

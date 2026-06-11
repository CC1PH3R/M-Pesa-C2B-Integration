import { Router, Request, Response } from 'express';
import authController from '../controllers/auth.controller';

const router = Router();

// Health check
router.get('/health', (req: Request, res: Response) =>
  authController.health(req, res),
);

// Test authentication (clears cache and fetches a fresh token)
router.get('/test-auth', (req: Request, res: Response) =>
  authController.testAuth(req, res),
);

export default router;

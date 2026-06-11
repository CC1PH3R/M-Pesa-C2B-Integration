import { Router, Request, Response } from 'express';
import authController from '../controllers/auth.controller';

const router = Router();

/**
 * @openapi
 * /api/ganji/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     description: Returns the current health status of the API service.
 *     responses:
 *       200:
 *         description: Service is running
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
router.get('/health', (req: Request, res: Response) =>
  authController.health(req, res),
);

/**
 * @openapi
 * /api/ganji/test-auth:
 *   get:
 *     tags: [Health]
 *     summary: Test Daraja OAuth authentication
 *     description: |
 *       Clears any cached access token and requests a fresh OAuth token from Safaricom Daraja.
 *       Use this endpoint to verify credentials and connectivity before calling payment APIs.
 *     responses:
 *       200:
 *         description: Authentication succeeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestAuthResponse'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/test-auth', (req: Request, res: Response) =>
  authController.testAuth(req, res),
);

export default router;

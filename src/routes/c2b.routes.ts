import { Router, Request, Response } from 'express';
import c2bController from '../controllers/c2b.controller';

const router = Router();

/**
 * @openapi
 * /api/ganji/register:
 *   post:
 *     tags: [C2B]
 *     summary: Register C2B callback URLs
 *     description: |
 *       Registers confirmation and validation URLs with Safaricom Daraja C2B v2 API.
 *       Run once after deployment or when callback URLs change. URLs are read from server configuration.
 *     responses:
 *       200:
 *         description: URLs registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: C2B URLs registered successfully
 *                     data:
 *                       $ref: '#/components/schemas/DarajaResponse'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/register', (req: Request, res: Response) =>
  c2bController.registerUrls(req, res),
);

/**
 * @openapi
 * /api/ganji/confirmation:
 *   post:
 *     tags: [C2B]
 *     summary: C2B payment confirmation callback
 *     description: |
 *       Webhook invoked by Safaricom when a customer completes a C2B payment.
 *       The server acknowledges immediately with `ResultCode: 0` and processes the payload asynchronously.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/C2BCallbackPayload'
 *     responses:
 *       200:
 *         description: Acknowledgement accepted by Safaricom
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MpesaAcknowledgement'
 */
router.post('/confirmation', (req: Request, res: Response) =>
  c2bController.confirmation(req, res),
);

/**
 * @openapi
 * /api/ganji/transactions:
 *   get:
 *     tags: [C2B]
 *     summary: List C2B transactions
 *     description: Returns stored C2B payment records, ordered by most recent first.
 *     parameters:
 *       - $ref: '#/components/parameters/LimitQuery'
 *     responses:
 *       200:
 *         description: Transaction list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionListResponse'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/transactions', (req: Request, res: Response) =>
  c2bController.getTransactions(req, res),
);

/**
 * @openapi
 * /api/ganji/transactions/{transID}:
 *   get:
 *     tags: [C2B]
 *     summary: Get C2B transaction by M-Pesa ID
 *     description: Retrieves a single stored C2B transaction using the Safaricom `TransID`.
 *     parameters:
 *       - $ref: '#/components/parameters/TransIDPath'
 *     responses:
 *       200:
 *         description: Transaction found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/transactions/:transID', (req: Request, res: Response) =>
  c2bController.getTransaction(req, res),
);

/**
 * @openapi
 * /api/ganji/simulate:
 *   post:
 *     tags: [C2B]
 *     summary: Simulate a C2B payment (sandbox)
 *     description: |
 *       Triggers a sandbox C2B payment simulation via Daraja. The confirmation callback
 *       is delivered asynchronously to the registered confirmation URL.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SimulateC2BRequest'
 *     responses:
 *       200:
 *         description: Simulation request accepted
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Payment simulation sent
 *                     data:
 *                       $ref: '#/components/schemas/DarajaResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/simulate', (req: Request, res: Response) =>
  c2bController.simulate(req, res),
);

export default router;

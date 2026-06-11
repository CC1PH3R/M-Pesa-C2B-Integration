import { Router, Request, Response } from 'express';
import stkPushController from '../controllers/stkpush.controller';

const router = Router();

/**
 * @openapi
 * /api/ganji/stk/push:
 *   post:
 *     tags: [STK Push]
 *     summary: Initiate STK Push
 *     description: |
 *       Sends a Lipa Na M-Pesa payment prompt to the customer's phone.
 *       On success, returns `CheckoutRequestID` for status queries and callback correlation.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StkPushInitiateRequest'
 *     responses:
 *       200:
 *         description: STK Push initiated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: STK Push initiated — customer will receive a payment prompt
 *                     data:
 *                       $ref: '#/components/schemas/StkPushInitiateData'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/stk/push', (req: Request, res: Response) =>
  stkPushController.stkPush(req, res),
);

/**
 * @openapi
 * /api/ganji/stk/query:
 *   post:
 *     tags: [STK Push]
 *     summary: Query STK Push status
 *     description: |
 *       Polls Daraja for the current status of an STK Push request.
 *       Recommended ~10 seconds after initiation if no callback has been received yet.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StkQueryRequest'
 *     responses:
 *       200:
 *         description: Query completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: STK Push query complete
 *                     data:
 *                       $ref: '#/components/schemas/DarajaResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/stk/query', (req: Request, res: Response) =>
  stkPushController.stkQuery(req, res),
);

/**
 * @openapi
 * /api/ganji/stk/callback:
 *   post:
 *     tags: [STK Push]
 *     summary: STK Push result callback
 *     description: |
 *       Webhook invoked by Safaricom with the final STK Push result.
 *       The server acknowledges immediately with `ResultCode: 0` and updates the stored request asynchronously.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StkCallbackPayload'
 *     responses:
 *       200:
 *         description: Acknowledgement accepted by Safaricom
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MpesaAcknowledgement'
 */
router.post('/stk/callback', (req: Request, res: Response) =>
  stkPushController.stkCallback(req, res),
);

/**
 * @openapi
 * /api/ganji/stk/requests:
 *   get:
 *     tags: [STK Push]
 *     summary: List STK Push requests
 *     description: Returns stored STK Push initiation records, ordered by most recent first.
 *     parameters:
 *       - $ref: '#/components/parameters/LimitQuery'
 *     responses:
 *       200:
 *         description: STK Push request list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StkRequestListResponse'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/stk/requests', (req: Request, res: Response) =>
  stkPushController.getStkRequests(req, res),
);

/**
 * @openapi
 * /api/ganji/stk/requests/{checkoutRequestID}:
 *   get:
 *     tags: [STK Push]
 *     summary: Get STK Push request by CheckoutRequestID
 *     description: Retrieves a single STK Push record including callback data when available.
 *     parameters:
 *       - $ref: '#/components/parameters/CheckoutRequestIDPath'
 *     responses:
 *       200:
 *         description: STK Push request found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StkRequestResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/stk/requests/:checkoutRequestID', (req: Request, res: Response) =>
  stkPushController.getStkRequest(req, res),
);

export default router;

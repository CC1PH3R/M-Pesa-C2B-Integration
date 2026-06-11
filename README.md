# M-Pesa C2B + STK Push Integration

A Node.js/TypeScript application for integrating with the M-Pesa Daraja API, supporting C2B (Customer to Business) payments and STK Push (Lipa Na M-Pesa). Stores all transactions in PostgreSQL via Prisma ORM.

## Features

- M-Pesa C2B API v2 integration (PayBill)
- STK Push / Lipa Na M-Pesa (M-Pesa Express)
- Access token caching to minimise Daraja API calls
- Async webhook handlers — responds to M-Pesa immediately, processes in background
- PostgreSQL storage with full audit trail for every transaction and STK request
- Payment simulation endpoint for sandbox testing
- Docker + Railway deployment ready

## Prerequisites

- Node.js 18+
- PostgreSQL database
- M-Pesa Daraja API credentials (Consumer Key, Secret, Shortcode, Passkey)
- HTTPS domain (Railway provides this automatically)

## Project Structure

```
src/
├── server.ts               # Express app, middleware, startup
├── config/
│   └── mpesa.ts            # Daraja API config, URL helpers, STK password generator
├── lib/
│   └── prisma.ts           # Shared Prisma client singleton
├── services/
│   ├── auth.service.ts     # Access token management (fetch + cache)
│   ├── c2b.service.ts      # C2B registration, callbacks, transactions
│   └── stkpush.service.ts  # STK Push initiation, query, callback handling
├── controllers/
│   ├── auth.controller.ts  # health, test-auth
│   ├── c2b.controller.ts   # register, confirmation, transactions, simulate
│   └── stkpush.controller.ts # stk/push, stk/query, stk/callback, stk/requests
└── routes/
    ├── index.ts            # Combines all route groups
    ├── auth.routes.ts      # /health, /test-auth
    ├── c2b.routes.ts       # /register, /confirmation, /transactions, /simulate
    └── stkpush.routes.ts   # /stk/push, /stk/query, /stk/callback, /stk/requests
prisma/
└── schema.prisma           # Transaction, StkPushRequest, AccessToken, UrlRegistration
```

## Important: Daraja URL Restriction

### API Base Path: `/api/ganji`

Daraja C2B v2 rejects callback URLs containing these keywords: `mpesa`, `safaricom`, `money`, `pay`, `payment`.

This app uses `/api/ganji` (slang for money) as the base path to comply.

- ❌ `https://yourapp.com/api/mpesa/confirmation`
- ✅ `https://yourapp.com/api/ganji/confirmation`

## Setup

### 1. Install

```bash
git clone https://github.com/CC1PH3R/M-Pesa-C2B-Integration.git
cd mpesa-c2b-test
npm install
```

### 2. Environment Variables

```env
PORT=3000
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Daraja credentials
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_paybill_shortcode
MPESA_PASSKEY=your_stk_passkey
MPESA_BASE_URL=https://api.safaricom.co.ke
MPESA_RESPONSE_TYPE=Completed

# Your deployed app URL (no trailing slash)
APP_BASE_URL=https://your-app.railway.app
```

### 3. Database

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Run

```bash
# Development
npm run dev

# Production
npm start
```

## API Reference

All endpoints are prefixed with `/api/ganji`.

---

### Auth / Utility

#### Health Check
```http
GET /api/ganji/health
```
```json
{ "success": true, "message": "M-Pesa C2B API is running", "timestamp": "..." }
```

#### Test Authentication
Forces a fresh token fetch (clears cache) and verifies your Daraja credentials.
```http
GET /api/ganji/test-auth
```
```json
{ "success": true, "message": "Authentication successful", "tokenInfo": { "length": 40, "prefix": "abc123..." } }
```

---

### C2B (Customer to Business)

#### Register C2B Callback URLs
Run once after deployment to register your confirmation URL with Safaricom.
```http
POST /api/ganji/register
```
```json
{ "success": true, "message": "C2B URLs registered successfully", "data": { "ResponseDescription": "Success" } }
```

#### C2B Confirmation Callback *(called by M-Pesa)*
Safaricom posts here when a customer pays via PayBill. Responds immediately, saves async.
```http
POST /api/ganji/confirmation
```
```json
{ "ResultCode": 0, "ResultDesc": "Success" }
```

#### Get All C2B Transactions
```http
GET /api/ganji/transactions?limit=50
```
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "uuid",
      "transID": "ABC123XYZ",
      "transAmount": "500.00",
      "msisdn": "254712345678",
      "billRefNumber": "account123",
      "transTime": "20241013143022",
      "createdAt": "2024-10-13T14:30:22Z"
    }
  ]
}
```

#### Get Single C2B Transaction
```http
GET /api/ganji/transactions/:transID
```

#### Simulate C2B Payment *(sandbox only)*
```http
POST /api/ganji/simulate
Content-Type: application/json

{
  "amount": 100,
  "msisdn": "254712345678",
  "billRefNumber": "test123"
}
```

---

### STK Push (Lipa Na M-Pesa / M-Pesa Express)

#### Initiate STK Push
Sends a payment prompt directly to the customer's phone.
```http
POST /api/ganji/stk/push
Content-Type: application/json

{
  "phoneNumber": "254712345678",
  "amount": 100,
  "accountRef": "Order-001",
  "description": "Payment"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `phoneNumber` | Yes | Format: `2547XXXXXXXX` or `2541XXXXXXXX` |
| `amount` | Yes | Whole number, minimum 1 KES |
| `accountRef` | Yes | Shown to customer, max 12 chars |
| `description` | No | Max 13 chars, defaults to `"Payment"` |

```json
{
  "success": true,
  "message": "STK Push initiated — customer will receive a payment prompt",
  "data": {
    "MerchantRequestID": "...",
    "CheckoutRequestID": "ws_CO_...",
    "ResponseCode": "0",
    "CustomerMessage": "Success. Request accepted for processing"
  }
}
```

#### Query STK Push Status
Poll the status of a push ~10 seconds after initiation if the callback has not arrived yet.
```http
POST /api/ganji/stk/query
Content-Type: application/json

{ "checkoutRequestID": "ws_CO_..." }
```
```json
{
  "success": true,
  "message": "STK Push query complete",
  "data": { "ResultCode": "0", "ResultDesc": "The service request is processed successfully." }
}
```

#### STK Push Callback *(called by M-Pesa)*
Safaricom posts here after the customer approves or cancels. Responds immediately, updates DB async.
```http
POST /api/ganji/stk/callback
```
```json
{ "ResultCode": 0, "ResultDesc": "Success" }
```

#### Get All STK Push Requests
```http
GET /api/ganji/stk/requests?limit=50
```
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "uuid",
      "checkoutRequestID": "ws_CO_...",
      "phoneNumber": "254712345678",
      "amount": "100.00",
      "resultCode": 0,
      "mpesaReceiptNumber": "ABC123",
      "createdAt": "2024-10-13T14:30:22Z"
    }
  ]
}
```

#### Get Single STK Push Request
```http
GET /api/ganji/stk/requests/:checkoutRequestID
```

---

## Railway Deployment

1. Create a new project from your GitHub repo.
2. Add a PostgreSQL database (Railway auto-creates `DATABASE_URL`).
3. Add all environment variables from the [Setup](#2-environment-variables) section.
4. Set `APP_BASE_URL` to your generated Railway domain (e.g. `https://your-app.railway.app`).
5. Railway will build the Docker image, run migrations, and start the server.

After first deploy, register your C2B URLs:
```bash
curl -X POST https://your-app.railway.app/api/ganji/register
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `Transaction` | C2B payment confirmations from M-Pesa |
| `StkPushRequest` | STK Push initiation + callback result |
| `AccessToken` | Cached Daraja OAuth tokens |
| `UrlRegistration` | Log of all C2B URL registration attempts |

---

## Troubleshooting

**`400.003.02 — Invalid ValidationURL (URL has the word MPESA)`**
Your callback URL contains a blocked keyword. Change the base path to something neutral (this app uses `/api/ganji`).

**Callbacks not received**
- Confirm `APP_BASE_URL` is set correctly (https, no trailing slash).
- Re-register: `POST /api/ganji/register`.
- Check Railway logs for incoming POST requests.

**STK Push returns error but no callback**
- Use `POST /api/ganji/stk/query` with the `checkoutRequestID` to poll the status.
- `ResultCode: 1032` = cancelled by user. `ResultCode: 1037` = timed out.

**401 / 403 auth errors**
- Verify credentials in Daraja portal, ensure app is Active.
- Check for extra whitespace: `GET /api/ganji/debug-config`.
- Use `GET /api/ganji/test-auth` to force a fresh token.

---

## Useful Commands

```bash
# View database in browser
npx prisma studio

# Create a new migration
npx prisma migrate dev --name migration_name

# View Railway logs
railway logs
```

## License

MIT

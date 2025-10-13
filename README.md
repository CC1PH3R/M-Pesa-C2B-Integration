# M-Pesa C2B Test Application

A comprehensive Node.js application for testing M-Pesa Daraja C2B (Customer to Business) API integration with PostgreSQL database storage.

## Features

- ✅ M-Pesa C2B API integration (Production ready)
- ✅ Secure credential management with environment variables
- ✅ Access token caching to minimize API calls
- ✅ Webhook handlers for validation and confirmation callbacks
- ✅ PostgreSQL database with Prisma ORM
- ✅ Complete transaction logging and storage
- ✅ Payment simulation endpoint for testing
- ✅ Docker containerization
- ✅ Railway deployment ready

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- M-Pesa Daraja API credentials (Consumer Key & Secret)
- M-Pesa Paybill Shortcode
- HTTPS domain (Railway provides this automatically)

## Project Structure

```
mpesa-c2b-test/
├── src/
│   ├── server.js              # Main application entry
│   ├── config/
│   │   └── mpesa.js           # M-Pesa configuration
│   ├── controllers/
│   │   └── mpesaController.js # Request handlers
│   ├── services/
│   │   └── mpesaService.js    # M-Pesa API logic
│   ├── routes/
│   │   └── mpesa.routes.js    # API routes
│   └── utils/
│       └── logger.js          # Logging utility
├── prisma/
│   └── schema.prisma          # Database schema
├── Dockerfile                 # Docker configuration
├── package.json
└── .env                       # Environment variables
```

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo>
cd mpesa-c2b-test
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:5432/dbname"
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_paybill_shortcode
MPESA_BASE_URL=https://api.safaricom.co.ke
APP_BASE_URL=https://your-app.railway.app
MPESA_RESPONSE_TYPE=Completed
```

### 3. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init
```

### 4. Run Locally

```bash
npm start
```

## Deployment to Railway

### Step 1: Create Railway Account
- Go to [railway.app](https://railway.app)
- Sign up with GitHub

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your repository

### Step 3: Add PostgreSQL Database
1. In your project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a `DATABASE_URL` variable

### Step 4: Configure Environment Variables
In Railway dashboard, add these variables:
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_BASE_URL` = `https://api.safaricom.co.ke`
- `MPESA_RESPONSE_TYPE` = `Completed`
- `NODE_ENV` = `production`

### Step 5: Set APP_BASE_URL
1. Railway will generate a domain like `your-app.railway.app`
2. Copy this URL
3. Add environment variable: `APP_BASE_URL` = `https://your-app.railway.app`
4. Redeploy the app

### Step 6: Deploy
Railway will automatically:
- Build the Docker image
- Run database migrations
- Start your application

## API Endpoints

### 1. Health Check
```http
GET /api/mpesa/health
```

### 2. Register C2B URLs with M-Pesa
```http
POST /api/mpesa/register
```
**Important:** Run this once after deployment to register your callback URLs with M-Pesa.

Response:
```json
{
  "success": true,
  "message": "C2B URLs registered successfully",
  "data": {
    "ResponseDescription": "Success"
  }
}
```

### 3. Get All Transactions
```http
GET /api/mpesa/transactions?limit=50
```

Response:
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "uuid",
      "transID": "ABC123XYZ",
      "transAmount": "1000.00",
      "msisdn": "254712345678",
      "billRefNumber": "account123",
      "transTime": "20241013143022",
      "createdAt": "2024-10-13T14:30:22Z"
    }
  ]
}
```

### 4. Get Single Transaction
```http
GET /api/mpesa/transactions/:transID
```

### 5. Simulate Payment (Testing)
```http
POST /api/mpesa/simulate
Content-Type: application/json

{
  "amount": 100,
  "msisdn": "254712345678",
  "billRefNumber": "test123"
}
```

### 6. M-Pesa Callbacks (Called by M-Pesa)
- **Validation:** `POST /api/mpesa/validation`
- **Confirmation:** `POST /api/mpesa/confirmation`

## Testing the Integration

### Step 1: Register URLs
After deployment, register your callback URLs:

```bash
curl -X POST https://your-app.railway.app/api/mpesa/register
```

### Step 2: Make a Real Payment
1. Open M-Pesa on your phone
2. Go to Lipa na M-Pesa → Pay Bill
3. Enter your Business Number (Shortcode)
4. Enter Account Number (can be anything)
5. Enter Amount
6. Enter your M-Pesa PIN
7. Confirm

### Step 3: Check Database
```bash
curl https://your-app.railway.app/api/mpesa/transactions
```

## Database Schema

### Transaction Table
- `id` - Unique identifier
- `transID` - M-Pesa transaction ID
- `transAmount` - Payment amount
- `msisdn` - Customer phone number
- `billRefNumber` - Account number
- `transTime` - Transaction timestamp
- `rawCallback` - Full M-Pesa callback (JSON)
- `processed` - Processing status
- `createdAt` - Record creation time

### AccessToken Table
- Caches M-Pesa access tokens
- Auto-expires based on M-Pesa's token lifetime

### UrlRegistration Table
- Logs all URL registration attempts
- Useful for debugging callback issues

## Troubleshooting

### Callbacks Not Received
1. **Check URL registration:**
   ```bash
   curl https://your-app.railway.app/api/mpesa/register
   ```

2. **Verify APP_BASE_URL is correct:**
   - Should be `https://your-app.railway.app` (with https)
   - No trailing slash

3. **Check Railway logs:**
   - Go to Railway dashboard → Deployments → Logs

### 403 Errors
- Ensure you're using `https://api.safaricom.co.ke` (with `api.` subdomain)
- Verify your Consumer Key and Secret are correct

### Database Connection Issues
- Railway automatically provides `DATABASE_URL`
- Ensure Prisma migrations ran: `npx prisma migrate deploy`

## Important Notes

### Validation Endpoint
The validation endpoint currently **accepts all transactions**. In production, implement business logic:

```javascript
// Example validation logic
if (amount < minimumAmount) {
  return res.json({ ResultCode: 1, ResultDesc: 'Amount too low' });
}

if (!isValidAccount(billRefNumber)) {
  return res.json({ ResultCode: 1, ResultDesc: 'Invalid account' });
}
```

### Response Time
- M-Pesa requires callback responses **within 30 seconds**
- The app responds immediately and processes asynchronously
- Never do heavy processing before responding to M-Pesa

### Security
- Never commit `.env` file
- Keep your Consumer Secret secure
- Use Railway's environment variables for secrets

## Development vs Production

### Development (Local)
```bash
npm run dev
```
- Uses `nodemon` for auto-reload
- Set `NODE_ENV=development`

### Production (Railway)
```bash
npm start
```
- Set `NODE_ENV=production`
- Runs database migrations automatically

## Useful Commands

```bash
# View database in browser
npx prisma studio

# Create new migration
npx prisma migrate dev --name migration_name

# Reset database (caution!)
npx prisma migrate reset

# Check logs (Railway)
railway logs
```

## Support

For M-Pesa API issues:
- Email: apisupport@safaricom.co.ke
- Daraja Portal: https://developer.safaricom.co.ke

## License

MIT
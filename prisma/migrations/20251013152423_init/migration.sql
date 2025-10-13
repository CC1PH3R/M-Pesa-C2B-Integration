-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "transID" TEXT NOT NULL,
    "transTime" TEXT NOT NULL,
    "transAmount" DECIMAL(10,2) NOT NULL,
    "businessShortCode" TEXT NOT NULL,
    "billRefNumber" TEXT,
    "invoiceNumber" TEXT,
    "msisdn" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "orgAccountBalance" DECIMAL(10,2),
    "rawCallback" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrlRegistration" (
    "id" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "confirmationURL" TEXT NOT NULL,
    "validationURL" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "response" JSONB,

    CONSTRAINT "UrlRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transID_key" ON "Transaction"("transID");

-- CreateIndex
CREATE INDEX "Transaction_transID_idx" ON "Transaction"("transID");

-- CreateIndex
CREATE INDEX "Transaction_msisdn_idx" ON "Transaction"("msisdn");

-- CreateIndex
CREATE INDEX "Transaction_transTime_idx" ON "Transaction"("transTime");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "UrlRegistration_registeredAt_idx" ON "UrlRegistration"("registeredAt");

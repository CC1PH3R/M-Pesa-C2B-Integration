-- CreateTable
CREATE TABLE "StkPushRequest" (
    "id" TEXT NOT NULL,
    "merchantRequestID" TEXT NOT NULL,
    "checkoutRequestID" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "accountRef" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responseCode" TEXT NOT NULL,
    "responseDescription" TEXT NOT NULL,
    "customerMessage" TEXT NOT NULL,
    "resultCode" INTEGER,
    "resultDesc" TEXT,
    "mpesaReceiptNumber" TEXT,
    "transactionDate" TEXT,
    "callbackPhoneNumber" TEXT,
    "rawCallback" JSONB,
    "callbackReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StkPushRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StkPushRequest_merchantRequestID_key" ON "StkPushRequest"("merchantRequestID");

-- CreateIndex
CREATE UNIQUE INDEX "StkPushRequest_checkoutRequestID_key" ON "StkPushRequest"("checkoutRequestID");

-- CreateIndex
CREATE INDEX "StkPushRequest_checkoutRequestID_idx" ON "StkPushRequest"("checkoutRequestID");

-- CreateIndex
CREATE INDEX "StkPushRequest_phoneNumber_idx" ON "StkPushRequest"("phoneNumber");

-- CreateIndex
CREATE INDEX "StkPushRequest_createdAt_idx" ON "StkPushRequest"("createdAt");

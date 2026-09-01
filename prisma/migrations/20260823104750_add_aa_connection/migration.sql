-- CreateEnum
CREATE TYPE "AAConnectionStatus" AS ENUM ('NOT_CONNECTED', 'INITIATED', 'PENDING', 'CONNECTED', 'FAILED');

-- CreateTable
CREATE TABLE "aa_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "vua" TEXT,
    "consentId" TEXT,
    "consentUrl" TEXT,
    "status" "AAConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aa_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aa_connections_userId_key" ON "aa_connections"("userId");

-- CreateIndex
CREATE INDEX "aa_connections_userId_idx" ON "aa_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "aa_connections" ADD CONSTRAINT "aa_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

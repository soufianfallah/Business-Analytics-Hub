CREATE TABLE "AIInsightCache" (
  "id" UUID NOT NULL, "cacheKey" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL, "statistics" JSONB NOT NULL, "response" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "organizationId" UUID NOT NULL,
  CONSTRAINT "AIInsightCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIInsightCache_organizationId_cacheKey_key" ON "AIInsightCache"("organizationId", "cacheKey");
CREATE INDEX "AIInsightCache_expiresAt_idx" ON "AIInsightCache"("expiresAt");
ALTER TABLE "AIInsightCache" ADD CONSTRAINT "AIInsightCache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

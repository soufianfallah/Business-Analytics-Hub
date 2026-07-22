-- CreateTable
CREATE TABLE "DatasetRow" (
    "id" UUID NOT NULL,
    "rowNumber" BIGINT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datasetId" UUID NOT NULL,

    CONSTRAINT "DatasetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetQueryCache" (
    "id" UUID NOT NULL,
    "queryHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "datasetId" UUID NOT NULL,

    CONSTRAINT "DatasetQueryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatasetRow_datasetId_idx" ON "DatasetRow"("datasetId");

-- CreateIndex
CREATE INDEX "DatasetRow_data_idx" ON "DatasetRow" USING GIN ("data");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRow_datasetId_rowNumber_key" ON "DatasetRow"("datasetId", "rowNumber");

-- CreateIndex
CREATE INDEX "DatasetQueryCache_expiresAt_idx" ON "DatasetQueryCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetQueryCache_datasetId_queryHash_key" ON "DatasetQueryCache"("datasetId", "queryHash");

-- AddForeignKey
ALTER TABLE "DatasetRow" ADD CONSTRAINT "DatasetRow_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetQueryCache" ADD CONSTRAINT "DatasetQueryCache_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

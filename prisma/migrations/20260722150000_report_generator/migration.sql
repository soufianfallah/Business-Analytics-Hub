CREATE TYPE "ReportRunStatus" AS ENUM ('QUEUED', 'GENERATING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReportTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

CREATE TABLE "ReportTemplate" (
  "id" UUID NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "configuration" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), "organizationId" UUID NOT NULL,
  "createdById" UUID NOT NULL, CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReportSchedule" (
  "id" UUID NOT NULL, "cron" TEXT NOT NULL, "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "recipients" JSONB NOT NULL DEFAULT '[]', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "nextRunAt" TIMESTAMP(3) NOT NULL, "lastRunAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "reportId" UUID NOT NULL, CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReportRun" (
  "id" UUID NOT NULL, "status" "ReportRunStatus" NOT NULL DEFAULT 'QUEUED',
  "trigger" "ReportTrigger" NOT NULL DEFAULT 'MANUAL', "format" "ReportFormat" NOT NULL,
  "storageKey" TEXT, "sizeBytes" BIGINT, "recipients" JSONB NOT NULL DEFAULT '[]', "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "reportId" UUID NOT NULL, CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Report" ADD COLUMN "templateId" UUID;
CREATE UNIQUE INDEX "ReportSchedule_reportId_key" ON "ReportSchedule"("reportId");
CREATE INDEX "Report_templateId_idx" ON "Report"("templateId");
CREATE INDEX "ReportTemplate_organizationId_deletedAt_idx" ON "ReportTemplate"("organizationId", "deletedAt");
CREATE INDEX "ReportTemplate_createdById_idx" ON "ReportTemplate"("createdById");
CREATE INDEX "ReportSchedule_isActive_nextRunAt_idx" ON "ReportSchedule"("isActive", "nextRunAt");
CREATE INDEX "ReportRun_reportId_createdAt_idx" ON "ReportRun"("reportId", "createdAt");
CREATE INDEX "ReportRun_status_createdAt_idx" ON "ReportRun"("status", "createdAt");
ALTER TABLE "Report" ADD CONSTRAINT "Report_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

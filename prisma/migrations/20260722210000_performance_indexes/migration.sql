CREATE INDEX "Dataset_organizationId_createdAt_idx" ON "Dataset"("organizationId", "createdAt" DESC) WHERE "deletedAt" IS NULL;
CREATE INDEX "Report_organizationId_createdAt_idx" ON "Report"("organizationId", "createdAt" DESC) WHERE "deletedAt" IS NULL;
CREATE INDEX "AiMessage_role_createdAt_idx" ON "AiMessage"("role", "createdAt" DESC);
CREATE INDEX "Subscription_planKey_status_idx" ON "Subscription"("planKey", "status");
CREATE INDEX "CsvUpload_organizationId_createdAt_idx" ON "CsvUpload"("organizationId", "createdAt" DESC);
CREATE INDEX "Organization_status_createdAt_idx" ON "Organization"("status", "createdAt" DESC);
CREATE INDEX "AuditLog_organizationId_action_createdAt_idx" ON "AuditLog"("organizationId", "action", "createdAt" DESC);

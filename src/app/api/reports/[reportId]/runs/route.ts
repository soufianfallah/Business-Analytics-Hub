import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { UsageLimitError } from "@/features/billing/application/usage-limits";
import { generateReport } from "@/features/reports/application/generate-report";
import { runReportSchema } from "@/features/reports/schemas/report-schema";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.nextUrl.host)
      throw new Error("INVALID_ORIGIN");
    const { reportId } = await params;
    const input = runReportSchema.parse(await request.json());
    const report = await prisma.report.findFirst({
      where: { id: reportId, deletedAt: null },
      select: { organizationId: true, format: true },
    });
    if (!report)
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const session = await requireOrganizationPermission(report.organizationId, {
      report: ["update"],
    });
    const runId = await generateReport(
      reportId,
      input.format ?? report.format,
      input.recipients,
    );
    await safeRecordAudit({
      organizationId: report.organizationId,
      userId: session.user.id,
      action: "EXPORT",
      entityType: "ReportRun",
      entityId: runId,
      description: "Report export generated",
      changes: {
        reportId,
        format: input.format ?? report.format,
        recipients: input.recipients.length,
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ runId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed.";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
          ? 403
          : error instanceof UsageLimitError
            ? 402
            : error instanceof z.ZodError
              ? 400
              : 500;
    return NextResponse.json(
      { error: status === 500 ? message : message },
      { status },
    );
  }
}

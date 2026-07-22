import { NextResponse } from "next/server";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { readReport } from "@/features/reports/infrastructure/report-storage";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const run = await prisma.reportRun.findUnique({
      where: { id: runId },
      include: { report: { select: { name: true, organizationId: true } } },
    });
    if (!run?.storageKey || run.status !== "COMPLETED")
      return NextResponse.json({ error: "Export not found." }, { status: 404 });
    const session = await requireOrganizationPermission(
      run.report.organizationId,
      {
        report: ["read"],
      },
    );
    const data = await readReport(run.storageKey);
    await safeRecordAudit({
      organizationId: run.report.organizationId,
      userId: session.user.id,
      action: "DOWNLOAD",
      entityType: "ReportRun",
      entityId: run.id,
      description: "Report export downloaded",
      changes: { format: run.format, reportName: run.report.name },
      ...requestAuditMetadata(request),
    });
    const extension = run.format === "XLSX" ? "xlsx" : run.format.toLowerCase();
    const contentType =
      run.format === "PDF"
        ? "application/pdf"
        : run.format === "XLSX"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8";
    return new NextResponse(data, {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${run.report.name.replaceAll('"', "")}.${extension}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "UNAUTHENTICATED"
            ? 401
            : message === "FORBIDDEN"
              ? 403
              : 500,
      },
    );
  }
}

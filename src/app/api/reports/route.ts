import { Prisma, ReportStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { reportInputSchema } from "@/features/reports/schemas/report-schema";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = reportInputSchema.parse(await request.json());
    const session = await requireOrganizationPermission(input.organizationId, {
      report: ["create"],
    });
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: input.datasetId,
        organizationId: input.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!dataset)
      return NextResponse.json(
        { error: "Dataset not found." },
        { status: 404 },
      );
    const configuration = { columns: input.columns } as Prisma.InputJsonValue;
    const result = await prisma.$transaction(async (tx) => {
      const template = input.saveAsTemplate
        ? await tx.reportTemplate.create({
            data: {
              name: input.name,
              description: input.description,
              configuration,
              organizationId: input.organizationId,
              createdById: session.user.id,
            },
          })
        : null;
      const report = await tx.report.create({
        data: {
          name: input.name,
          description: input.description,
          datasetId: input.datasetId,
          organizationId: input.organizationId,
          createdById: session.user.id,
          format: input.format,
          configuration,
          templateId: template?.id,
          status: ReportStatus.DRAFT,
        },
      });
      if (input.schedule)
        await tx.reportSchedule.create({
          data: {
            reportId: report.id,
            cron: cronFor(input.schedule.frequency),
            timezone: input.schedule.timezone,
            recipients: input.schedule.recipients,
            nextRunAt: nextRun(input.schedule.frequency),
          },
        });
      return report;
    });
    await safeRecordAudit({
      organizationId: input.organizationId,
      userId: session.user.id,
      action: "CREATE",
      entityType: "Report",
      entityId: result.id,
      description: "Report definition created",
      changes: {
        name: result.name,
        format: result.format,
        datasetId: result.datasetId,
        scheduled: Boolean(input.schedule),
        savedTemplate: input.saveAsTemplate,
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ report: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

const cronFor = (frequency: "daily" | "weekly" | "monthly") =>
  frequency === "daily"
    ? "0 8 * * *"
    : frequency === "weekly"
      ? "0 8 * * 1"
      : "0 8 1 * *";
function nextRun(frequency: "daily" | "weekly" | "monthly") {
  const date = new Date();
  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + 1);
  else if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCMonth(date.getUTCMonth() + 1, 1);
  date.setUTCHours(8, 0, 0, 0);
  return date;
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}
function apiError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to create report.";
  const status =
    message === "UNAUTHENTICATED"
      ? 401
      : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
        ? 403
        : error instanceof z.ZodError
          ? 400
          : 500;
  return NextResponse.json(
    { error: status === 500 ? "Unable to create report." : message },
    { status },
  );
}

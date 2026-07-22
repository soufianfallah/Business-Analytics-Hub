import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

const layoutSchema = z.object({
  widgetIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dashboardId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { dashboardId } = await context.params;
    const input = layoutSchema.parse(await request.json());
    if (new Set(input.widgetIds).size !== input.widgetIds.length)
      return NextResponse.json(
        { error: "Widget IDs must be unique." },
        { status: 400 },
      );

    const dashboard = await prisma.dashboard.findFirst({
      where: { id: dashboardId, deletedAt: null },
      select: {
        organizationId: true,
        widgets: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!dashboard)
      return NextResponse.json(
        { error: "Dashboard not found." },
        { status: 404 },
      );
    const session = await requireOrganizationPermission(
      dashboard.organizationId,
      {
        dashboard: ["update"],
      },
    );

    const storedIds = new Set(dashboard.widgets.map((widget) => widget.id));
    if (
      storedIds.size !== input.widgetIds.length ||
      input.widgetIds.some((id) => !storedIds.has(id))
    ) {
      return NextResponse.json(
        { error: "Layout must contain every dashboard widget exactly once." },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.dashboard.update({
        where: { id: dashboardId },
        data: {
          layout: {
            version: 1,
            mode: "ordered-grid",
            widgetIds: input.widgetIds,
          } as Prisma.InputJsonValue,
        },
      }),
      ...input.widgetIds.map((id, sortOrder) =>
        prisma.widget.update({
          where: { id },
          data: { sortOrder, position: { order: sortOrder } },
        }),
      ),
    ]);
    await safeRecordAudit({
      organizationId: dashboard.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Dashboard",
      entityId: dashboardId,
      description: "Dashboard layout updated",
      changes: { widgetOrder: input.widgetIds },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save layout.";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : error instanceof z.ZodError
            ? 400
            : message === "INVALID_ORIGIN"
              ? 403
              : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to save layout." : message },
      { status },
    );
  }
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}

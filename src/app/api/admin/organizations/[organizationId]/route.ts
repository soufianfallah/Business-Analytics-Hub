import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/features/admin/server/authorization";
import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]),
});
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    sameOrigin(request);
    const admin = await getPlatformAdmin();
    const { organizationId } = await params;
    const { status } = schema.parse(await request.json());
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, status: true },
    });
    if (!organization)
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status, deletedAt: status === "ARCHIVED" ? new Date() : null },
    });
    await safeRecordAudit({
      organizationId,
      userId: admin.id,
      action: "ORGANIZATION_CHANGE",
      entityType: "Organization",
      entityId: organizationId,
      description: "Platform administrator changed organization status",
      changes: {
        from: organization.status,
        to: status,
        name: organization.name,
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Admin action failed.";
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "UNAUTHENTICATED"
            ? 401
            : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
              ? 403
              : error instanceof z.ZodError
                ? 400
                : 500,
      },
    );
  }
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}

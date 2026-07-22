import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/features/admin/server/authorization";
import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  action: z.enum(["suspend", "restore", "promote", "demote"]),
});
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    sameOrigin(request);
    const admin = await getPlatformAdmin();
    const { userId } = await params;
    const { action } = schema.parse(await request.json());
    if (userId === admin.id && ["suspend", "demote"].includes(action))
      return NextResponse.json(
        { error: "You cannot remove your own administrator access." },
        { status: 409 },
      );
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, platformRole: true, deletedAt: true },
    });
    if (!target)
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    const data =
      action === "suspend"
        ? { deletedAt: new Date() }
        : action === "restore"
          ? { deletedAt: null }
          : action === "promote"
            ? { platformRole: "ADMIN" as const }
            : { platformRole: "USER" as const };
    await prisma.user.update({ where: { id: userId }, data });
    if (action === "suspend")
      await prisma.session.deleteMany({ where: { userId } });
    await safeRecordAudit({
      userId: admin.id,
      action:
        action === "promote" || action === "demote" ? "ROLE_CHANGE" : "UPDATE",
      entityType: "User",
      entityId: userId,
      description: `Platform administrator ${action}d a user`,
      changes: {
        targetEmail: target.email,
        action,
        previousRole: target.platformRole,
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return adminError(error);
  }
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}
function adminError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Admin action failed.";
  const status =
    message === "UNAUTHENTICATED"
      ? 401
      : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
        ? 403
        : error instanceof z.ZodError
          ? 400
          : 500;
  return NextResponse.json(
    { error: status === 500 ? "Admin action failed." : message },
    { status },
  );
}

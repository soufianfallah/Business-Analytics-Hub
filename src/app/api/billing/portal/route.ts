import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { getStripe } from "@/features/billing/infrastructure/stripe-client";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({ organizationId: z.string().uuid() });
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.nextUrl.host)
      throw new Error("INVALID_ORIGIN");
    const { organizationId } = schema.parse(await request.json());
    const session = await requireOrganizationPermission(organizationId, {
      billing: ["read"],
    });
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription?.providerCustomerId)
      return NextResponse.json(
        { error: "No Stripe billing account exists yet." },
        { status: 404 },
      );
    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: `${getServerEnv().BETTER_AUTH_URL}/dashboard/billing`,
    });
    await safeRecordAudit({
      organizationId,
      userId: session.user.id,
      action: "BILLING",
      entityType: "StripePortalSession",
      entityId: portal.id,
      description: "Stripe customer portal opened",
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to open billing portal.";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
          ? 403
          : error instanceof z.ZodError
            ? 400
            : message === "STRIPE_NOT_CONFIGURED"
              ? 503
              : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to open billing portal." : message },
      { status },
    );
  }
}

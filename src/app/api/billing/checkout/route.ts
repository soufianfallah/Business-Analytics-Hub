import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { getStripe } from "@/features/billing/infrastructure/stripe-client";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  organizationId: z.string().uuid(),
  interval: z.enum(["monthly", "yearly"]),
});
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = schema.parse(await request.json());
    const session = await requireOrganizationPermission(input.organizationId, {
      billing: ["update"],
    });
    const env = getServerEnv();
    const price =
      input.interval === "monthly"
        ? env.STRIPE_PRO_MONTHLY_PRICE_ID
        : env.STRIPE_PRO_YEARLY_PRICE_ID;
    if (!price) throw new Error("STRIPE_PRICE_NOT_CONFIGURED");
    const organization = await prisma.organization.findFirst({
      where: { id: input.organizationId, deletedAt: null },
      include: { subscription: true },
    });
    if (!organization)
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    const stripe = getStripe();
    let customerId = organization.subscription?.providerCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: organization.name,
        email: session.user.email,
        metadata: { organizationId: organization.id },
      });
      customerId = customer.id;
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: {
        metadata: { organizationId: organization.id, planKey: "pro" },
        trial_period_days: organization.subscription ? undefined : 14,
      },
      allow_promotion_codes: true,
      success_url: `${env.BETTER_AUTH_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${env.BETTER_AUTH_URL}/dashboard/billing?checkout=cancelled`,
      metadata: { organizationId: organization.id, planKey: "pro" },
    });
    await safeRecordAudit({
      organizationId: input.organizationId,
      userId: session.user.id,
      action: "BILLING",
      entityType: "StripeCheckoutSession",
      entityId: checkout.id,
      description: "Pro checkout session created",
      changes: {
        plan: "pro",
        interval: input.interval,
        trialDays: organization.subscription ? 0 : 14,
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    return failure(error, "Unable to create checkout.");
  }
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}
function failure(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "UNAUTHENTICATED"
      ? 401
      : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
        ? 403
        : error instanceof z.ZodError
          ? 400
          : message.includes("NOT_CONFIGURED")
            ? 503
            : 500;
  return NextResponse.json(
    { error: status === 500 ? fallback : message },
    { status },
  );
}

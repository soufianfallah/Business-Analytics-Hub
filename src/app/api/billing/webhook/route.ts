import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { safeRecordAudit } from "@/features/audit/application/audit-service";
import { getStripe } from "@/features/billing/infrastructure/stripe-client";
import { syncStripeSubscription } from "@/features/billing/application/stripe-subscription";
import { getServerEnv } from "@/lib/env";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = getServerEnv().STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }
  try {
    if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncStripeSubscription(subscription);
      if (subscription.metadata.organizationId)
        await safeRecordAudit({
          organizationId: subscription.metadata.organizationId,
          action: "BILLING",
          entityType: "StripeSubscription",
          entityId: subscription.id,
          description: `Stripe subscription event: ${event.type}`,
          changes: {
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            planKey: subscription.metadata.planKey,
          },
          metadata: { stripeEventId: event.id },
        });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing.webhook] sync failed", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}

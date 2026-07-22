import "server-only";

import type Stripe from "stripe";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const statuses: Partial<
  Record<Stripe.Subscription.Status, SubscriptionStatus>
> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  paused: "PAUSED",
  canceled: "CANCELLED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "EXPIRED",
  unpaid: "PAST_DUE",
};
export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
) {
  const organizationId = subscription.metadata.organizationId;
  if (!organizationId)
    throw new Error("Stripe subscription is missing organizationId metadata.");
  const item = subscription.items.data[0];
  const interval =
    item?.price.recurring?.interval === "year"
      ? BillingInterval.YEARLY
      : BillingInterval.MONTHLY;
  await prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      provider: "stripe",
      providerCustomerId: String(subscription.customer),
      providerSubscriptionId: subscription.id,
      planKey: subscription.metadata.planKey ?? "pro",
      status: statuses[subscription.status] ?? "INCOMPLETE",
      billingInterval: interval,
      currency: item?.price.currency ?? "usd",
      unitAmount: item?.price.unit_amount ?? 0,
      currentPeriodStart: item
        ? new Date(item.current_period_start * 1000)
        : null,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
    update: {
      providerCustomerId: String(subscription.customer),
      providerSubscriptionId: subscription.id,
      planKey: subscription.metadata.planKey ?? "pro",
      status: statuses[subscription.status] ?? "INCOMPLETE",
      billingInterval: interval,
      currency: item?.price.currency ?? "usd",
      unitAmount: item?.price.unit_amount ?? 0,
      currentPeriodStart: item
        ? new Date(item.current_period_start * 1000)
        : null,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
  });
}

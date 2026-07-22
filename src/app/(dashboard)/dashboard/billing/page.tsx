import { CreditCard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getOrganizationUsage } from "@/features/billing/application/usage-limits";
import { BillingManager } from "@/features/billing/components/billing-manager";
import { getStripe } from "@/features/billing/infrastructure/stripe-client";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { requireSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";

export default async function BillingPage() {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId)
    return (
      <EmptyState
        title="Choose an organization"
        description="Billing is managed per organization."
        action={
          <Button asChild>
            <Link href="/dashboard/organizations">Manage organizations</Link>
          </Button>
        }
      />
    );
  await requireOrganizationPermission(organizationId, { billing: ["read"] });
  const state = await getOrganizationUsage(organizationId);
  const env = getServerEnv();
  const billingConfigured = Boolean(
    env.STRIPE_SECRET_KEY?.startsWith("sk_test_") &&
    env.STRIPE_PRO_MONTHLY_PRICE_ID &&
    env.STRIPE_PRO_YEARLY_PRICE_ID,
  );
  let invoices: Array<{
    id: string;
    number: string | null;
    amount: number;
    currency: string;
    status: string | null;
    url: string | null;
    created: string;
  }> = [];
  if (billingConfigured && state.subscription?.providerCustomerId) {
    try {
      const result = await getStripe().invoices.list({
        customer: state.subscription.providerCustomerId,
        limit: 12,
      });
      invoices = result.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        amount: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        url: invoice.hosted_invoice_url ?? null,
        created: new Date(invoice.created * 1000).toISOString(),
      }));
    } catch (error) {
      console.error("[billing] invoice list failed", {
        organizationId,
        message: error instanceof Error ? error.message : "Unknown",
      });
    }
  }
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Organization</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CreditCard className="size-6" />
          Plans and billing
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage plan limits, test-mode checkout, invoices, and subscription
          settings.
        </p>
      </div>
      <BillingManager
        organizationId={organizationId}
        currentPlan={state.planKey}
        billingConfigured={billingConfigured}
        usage={state.usage}
        limits={state.limits}
        invoices={invoices}
      />
    </section>
  );
}

"use client";

import { useState } from "react";
import { Building2, Check, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { plans, type PlanKey } from "@/features/billing/domain/plans";

type BillingProps = {
  organizationId: string;
  currentPlan: PlanKey;
  billingConfigured: boolean;
  usage: Record<string, number>;
  limits: Record<string, number>;
  invoices: Array<{
    id: string;
    number: string | null;
    amount: number;
    currency: string;
    status: string | null;
    url: string | null;
    created: string;
  }>;
};
export function BillingManager({
  organizationId,
  currentPlan,
  billingConfigured,
  usage,
  limits,
  invoices,
}: BillingProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function redirect(endpoint: string, body: object) {
    setBusy(endpoint);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? "Billing request failed.");
      window.location.assign(result.url);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Billing request failed.",
      );
      setBusy(null);
    }
  }
  const features: Record<PlanKey, string[]> = {
    free: [
      "3 datasets",
      "2 dashboards",
      "10 report runs/month",
      "30 AI answers/month",
    ],
    pro: [
      "50 datasets",
      "25 dashboards",
      "500 report runs/month",
      "1,000 AI answers/month",
      "14-day trial",
    ],
    enterprise: [
      "Custom usage limits",
      "Custom onboarding",
      "Priority support",
      "Security review",
    ],
  };
  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {(["free", "pro", "enterprise"] as const).map((key) => (
          <Card
            key={key}
            className={key === currentPlan ? "border-primary" : ""}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plans[key].name}</CardTitle>
                {key === currentPlan ? <Badge>Current</Badge> : null}
              </div>
              <CardDescription>{plans[key].description}</CardDescription>
              <p className="pt-2 text-3xl font-semibold">
                {plans[key].monthlyPrice == null
                  ? "Custom"
                  : plans[key].monthlyPrice === 0
                    ? "Free"
                    : `$${plans[key].monthlyPrice}`}{" "}
                {plans[key].monthlyPrice ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    / month
                  </span>
                ) : null}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {features[key].map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <Check className="size-4 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {key === "free" ? (
                  <Button className="w-full" variant="outline" disabled>
                    {currentPlan === "free"
                      ? "Your plan"
                      : "Downgrade in portal"}
                  </Button>
                ) : key === "pro" ? (
                  currentPlan === "free" ? (
                    <Button
                      className="w-full"
                      disabled={!billingConfigured || busy !== null}
                      onClick={() =>
                        redirect("/api/billing/checkout", {
                          organizationId,
                          interval: "monthly",
                        })
                      }
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      Start free trial
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() =>
                        redirect("/api/billing/portal", { organizationId })
                      }
                    >
                      Manage plan
                    </Button>
                  )
                ) : (
                  <Button asChild className="w-full" variant="outline">
                    <a href="mailto:sales@businessanalyticshub.local">
                      <Building2 className="size-4" />
                      Contact sales
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!billingConfigured ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <strong>Safe design mode:</strong> Stripe test keys and test price IDs
          are not configured. The Free plan works; paid checkout cannot create a
          charge.
        </div>
      ) : null}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Usage</CardTitle>
            <CardDescription>
              Current organization usage and enforced plan limits.
            </CardDescription>
          </div>
          {currentPlan !== "free" ? (
            <Button
              variant="outline"
              onClick={() =>
                redirect("/api/billing/portal", { organizationId })
              }
            >
              <ExternalLink className="size-4" />
              Customer portal
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(usage).map(([resource, used]) => (
            <div key={resource} className="rounded-lg border p-3">
              <p className="text-xs capitalize text-muted-foreground">
                {resource.replace(/([A-Z])/g, " $1")}
              </p>
              <p className="mt-1 font-medium">
                {resource === "storageBytes"
                  ? formatBytes(used)
                  : used.toLocaleString()}{" "}
                <span className="font-normal text-muted-foreground">
                  /{" "}
                  {Number.isFinite(limits[resource])
                    ? resource === "storageBytes"
                      ? formatBytes(limits[resource]!)
                      : limits[resource]!.toLocaleString()
                    : "Unlimited"}
                </span>
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Invoices are provided by Stripe and can also be downloaded from the
            portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length ? (
            <div className="divide-y rounded-lg border">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {invoice.number ?? invoice.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.created).toLocaleDateString()} ·{" "}
                      {invoice.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: invoice.currency,
                      }).format(invoice.amount / 100)}
                    </span>
                    {invoice.url ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={invoice.url} rel="noreferrer" target="_blank">
                          View
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function formatBytes(value: number) {
  if (!value) return "0 MB";
  return `${(value / 1024 ** (value >= 1024 ** 3 ? 3 : 2)).toFixed(1)} ${value >= 1024 ** 3 ? "GB" : "MB"}`;
}

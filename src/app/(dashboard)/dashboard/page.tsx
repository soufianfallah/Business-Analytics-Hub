import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AnalyticsDashboardGrid } from "@/features/dashboards/components/analytics-dashboard-grid";
import { DemoDataBadge } from "@/features/dashboards/components/analytics-widget";
import {
  createMainDashboard,
  findMainDashboard,
  serializeWidgets,
} from "@/features/dashboards/server/main-dashboard";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { requireSession } from "@/lib/auth/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;

  if (!organizationId)
    return (
      <section className="grid min-h-[60vh] place-items-center">
        <div className="max-w-md text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl border bg-muted/40">
            <LayoutDashboard className="size-5 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Choose an organization</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select or create an organization before opening its analytics
            dashboard.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/organizations">Manage organizations</Link>
          </Button>
        </div>
      </section>
    );

  await requireOrganizationPermission(organizationId, { dashboard: ["read"] });
  let dashboard = await findMainDashboard(organizationId);
  if (!dashboard) {
    await requireOrganizationPermission(organizationId, {
      dashboard: ["create"],
    });
    dashboard = await createMainDashboard(organizationId, session.user.id);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Overview</p>
            <DemoDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Analytics dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor performance across your organization. Drag any card by its
            handle to rearrange it.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Layout saves automatically
        </p>
      </div>
      <AnalyticsDashboardGrid
        dashboardId={dashboard.id}
        initialWidgets={serializeWidgets(dashboard.widgets)}
      />
    </section>
  );
}

import "server-only";

import { DashboardVisibility, Prisma, WidgetType } from "@prisma/client";

import { assertWithinUsageLimit } from "@/features/billing/application/usage-limits";
import { safeRecordAudit } from "@/features/audit/application/audit-service";
import type {
  AnalyticsWidget,
  AnalyticsWidgetConfig,
} from "@/features/dashboards/domain/analytics-widget";
import { prisma } from "@/lib/db/prisma";

const definitions: Array<{
  title: string;
  description: string;
  type: WidgetType;
  config: AnalyticsWidgetConfig;
}> = [
  {
    title: "Revenue",
    description: "Total revenue this month",
    type: WidgetType.KPI,
    config: {
      kind: "metric",
      value: 128430,
      change: 12.5,
      format: "currency",
      icon: "revenue",
    },
  },
  {
    title: "Orders",
    description: "Orders completed this month",
    type: WidgetType.KPI,
    config: {
      kind: "metric",
      value: 2480,
      change: 8.2,
      format: "number",
      icon: "orders",
    },
  },
  {
    title: "Customers",
    description: "Active customers",
    type: WidgetType.KPI,
    config: {
      kind: "metric",
      value: 1854,
      change: 5.4,
      format: "number",
      icon: "customers",
    },
  },
  {
    title: "Conversion Rate",
    description: "Visitor to customer rate",
    type: WidgetType.KPI,
    config: {
      kind: "metric",
      value: 3.64,
      change: 0.6,
      format: "percent",
      icon: "conversion",
    },
  },
  {
    title: "Profit",
    description: "Net profit this month",
    type: WidgetType.KPI,
    config: {
      kind: "metric",
      value: 48250,
      change: 10.1,
      format: "currency",
      icon: "profit",
    },
  },
  {
    title: "Growth",
    description: "Month-over-month growth",
    type: WidgetType.KPI,
    config: {
      kind: "metric",
      value: 18.2,
      change: 2.4,
      format: "percent",
      icon: "growth",
    },
  },
  {
    title: "Traffic",
    description: "Visitors and sessions over the last 7 days",
    type: WidgetType.AREA_CHART,
    config: {
      kind: "traffic",
      series: [
        { label: "Mon", visitors: 2400, sessions: 1680 },
        { label: "Tue", visitors: 3100, sessions: 2120 },
        { label: "Wed", visitors: 2780, sessions: 1940 },
        { label: "Thu", visitors: 3900, sessions: 2640 },
        { label: "Fri", visitors: 4250, sessions: 2980 },
        { label: "Sat", visitors: 3600, sessions: 2440 },
        { label: "Sun", visitors: 4680, sessions: 3210 },
      ],
    },
  },
  {
    title: "Top Products",
    description: "Best-performing products by revenue",
    type: WidgetType.TABLE,
    config: {
      kind: "products",
      products: [
        { name: "Analytics Pro", sales: 842, revenue: 42100, change: 14.2 },
        { name: "Team Workspace", sales: 614, revenue: 30700, change: 9.8 },
        { name: "Data Connect", sales: 487, revenue: 24350, change: 7.1 },
        { name: "Report Builder", sales: 356, revenue: 17800, change: -2.3 },
      ],
    },
  },
  {
    title: "Recent Activity",
    description: "Latest workspace events",
    type: WidgetType.TEXT,
    config: {
      kind: "activity",
      activities: [
        {
          title: "Dataset refreshed",
          detail: "Sales performance",
          time: "12 min ago",
          tone: "green",
        },
        {
          title: "Report exported",
          detail: "Monthly executive report",
          time: "1 hr ago",
          tone: "blue",
        },
        {
          title: "Dashboard shared",
          detail: "Marketing overview",
          time: "3 hrs ago",
          tone: "violet",
        },
        {
          title: "Member joined",
          detail: "A new analyst joined",
          time: "Yesterday",
          tone: "green",
        },
      ],
    },
  },
];

const includeWidgets = {
  widgets: {
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" as const },
  },
};

export async function findMainDashboard(organizationId: string) {
  return prisma.dashboard.findFirst({
    where: { organizationId, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: includeWidgets,
  });
}

export async function createMainDashboard(
  organizationId: string,
  userId: string,
) {
  await assertWithinUsageLimit(organizationId, "dashboards");
  const dashboard = await prisma.dashboard.create({
    data: {
      name: "Analytics Overview",
      description: "Organization-wide business performance",
      organizationId,
      createdById: userId,
      isDefault: true,
      visibility: DashboardVisibility.ORGANIZATION,
      layout: { version: 1, mode: "ordered-grid" },
      widgets: {
        create: definitions.map((widget, sortOrder) => ({
          title: widget.title,
          description: widget.description,
          type: widget.type,
          config: widget.config as Prisma.InputJsonValue,
          position: { order: sortOrder },
          sortOrder,
          createdById: userId,
        })),
      },
    },
    include: includeWidgets,
  });
  await safeRecordAudit({
    organizationId,
    userId,
    action: "CREATE",
    entityType: "Dashboard",
    entityId: dashboard.id,
    description: "Default analytics dashboard created",
    changes: { name: dashboard.name, widgets: dashboard.widgets.length },
  });
  return dashboard;
}

export function serializeWidgets(
  widgets: NonNullable<
    Awaited<ReturnType<typeof findMainDashboard>>
  >["widgets"],
): AnalyticsWidget[] {
  return widgets.map((widget) => ({
    id: widget.id,
    title: widget.title,
    description: widget.description,
    config: widget.config as unknown as AnalyticsWidgetConfig,
    sortOrder: widget.sortOrder,
  }));
}

"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  ChartNoAxesCombined,
  CircleDollarSign,
  MousePointerClick,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type {
  AnalyticsWidget as AnalyticsWidgetModel,
  MetricWidgetConfig,
} from "@/features/dashboards/domain/analytics-widget";
import { cn } from "@/lib/utils";

const icons = {
  revenue: CircleDollarSign,
  orders: ShoppingCart,
  customers: Users,
  conversion: MousePointerClick,
  profit: BadgeDollarSign,
  growth: ChartNoAxesCombined,
};

function formatMetric(config: MetricWidgetConfig) {
  if (config.format === "currency")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(config.value);
  if (config.format === "percent") return `${config.value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US").format(config.value);
}

function WidgetFrame({
  widget,
  children,
  className,
}: {
  widget: AnalyticsWidgetModel;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "h-full overflow-hidden shadow-sm shadow-black/[0.03]",
        className,
      )}
    >
      <CardHeader className="space-y-1 p-5 pb-3">
        <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
        {widget.description ? (
          <CardDescription className="text-xs">
            {widget.description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="p-5 pt-0">{children}</CardContent>
    </Card>
  );
}

export function AnalyticsWidget({ widget }: { widget: AnalyticsWidgetModel }) {
  const config = widget.config;
  if (config.kind === "metric") {
    const Icon = icons[config.icon];
    const positive = config.change >= 0;
    return (
      <WidgetFrame widget={widget}>
        <div className="flex items-end justify-between gap-4 pt-2">
          <div>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {formatMetric(config)}
            </p>
            <p
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {positive ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {Math.abs(config.change)}%{" "}
              <span className="font-normal text-muted-foreground">
                vs last month
              </span>
            </p>
          </div>
          <div className="grid size-10 place-items-center rounded-lg border bg-muted/40">
            <Icon className="size-5 text-muted-foreground" />
          </div>
        </div>
      </WidgetFrame>
    );
  }

  if (config.kind === "traffic")
    return (
      <WidgetFrame widget={widget}>
        <ChartContainer
          className="aspect-auto h-[260px] w-full"
          config={{
            visitors: { label: "Visitors", color: "hsl(var(--primary))" },
            sessions: {
              label: "Sessions",
              color: "hsl(var(--muted-foreground))",
            },
          }}
        >
          <AreaChart
            accessibilityLayer
            data={config.series}
            margin={{ left: -18, right: 8, top: 12 }}
          >
            <defs>
              <linearGradient
                id={`traffic-${widget.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-visitors)"
                  stopOpacity={0.32}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-visitors)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${Number(value) / 1000}k`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="sessions"
              type="monotone"
              stroke="var(--color-sessions)"
              fill="transparent"
              strokeWidth={2}
            />
            <Area
              dataKey="visitors"
              type="monotone"
              stroke="var(--color-visitors)"
              fill={`url(#traffic-${widget.id})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </WidgetFrame>
    );

  if (config.kind === "products")
    return (
      <WidgetFrame widget={widget}>
        <div className="divide-y">
          {config.products.map((product, index) => (
            <div
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3"
              key={product.name}
            >
              <span className="grid size-8 place-items-center rounded-md bg-muted text-xs font-semibold">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.sales.toLocaleString()} sales
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">
                  ${product.revenue.toLocaleString()}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    product.change >= 0 ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {product.change >= 0 ? "+" : ""}
                  {product.change}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </WidgetFrame>
    );

  return (
    <WidgetFrame widget={widget}>
      <div className="space-y-1">
        {config.activities.map((activity) => (
          <div
            className="flex gap-3 py-3"
            key={`${activity.title}-${activity.time}`}
          >
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                activity.tone === "green"
                  ? "bg-emerald-500"
                  : activity.tone === "violet"
                    ? "bg-violet-500"
                    : "bg-blue-500",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{activity.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {activity.detail}
              </p>
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {activity.time}
            </span>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

export function DemoDataBadge() {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      Demo data
    </Badge>
  );
}

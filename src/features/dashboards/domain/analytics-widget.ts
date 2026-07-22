export type MetricFormat = "currency" | "number" | "percent";

export type MetricWidgetConfig = {
  kind: "metric";
  value: number;
  change: number;
  format: MetricFormat;
  icon: "revenue" | "orders" | "customers" | "conversion" | "profit" | "growth";
};

export type TrafficWidgetConfig = {
  kind: "traffic";
  series: Array<{ label: string; visitors: number; sessions: number }>;
};

export type ProductsWidgetConfig = {
  kind: "products";
  products: Array<{
    name: string;
    sales: number;
    revenue: number;
    change: number;
  }>;
};

export type ActivityWidgetConfig = {
  kind: "activity";
  activities: Array<{
    title: string;
    detail: string;
    time: string;
    tone: "blue" | "green" | "violet";
  }>;
};

export type AnalyticsWidgetConfig =
  | MetricWidgetConfig
  | TrafficWidgetConfig
  | ProductsWidgetConfig
  | ActivityWidgetConfig;

export type AnalyticsWidget = {
  id: string;
  title: string;
  description: string | null;
  config: AnalyticsWidgetConfig;
  sortOrder: number;
};

export type ChartDatum = Record<string, string | number | null>;

export type ChartSeries = {
  key: string;
  label?: string;
  color?: string;
};

export type AnalyticsChartType =
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "donut"
  | "radar"
  | "scatter"
  | "heatmap"
  | "funnel"
  | "treemap";

export type AnalyticsChartProps = {
  type: AnalyticsChartType;
  data: ChartDatum[];
  series: ChartSeries[];
  categoryKey?: string;
  xKey?: string;
  yKey?: string;
  sizeKey?: string;
  loading?: boolean;
  title?: string;
  description?: string;
  emptyTitle?: string;
  exportFileName?: string;
  className?: string;
  height?: number;
  showLegend?: boolean;
};

"use client";

import { useRef, useState } from "react";
import { Download, LineChart as LineChartIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
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
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AnalyticsChartProps,
  ChartSeries,
} from "@/features/charts/domain/chart-types";
import { cn } from "@/lib/utils";

const palette = [
  "hsl(var(--chart-1, 221 83% 53%))",
  "hsl(var(--chart-2, 160 84% 39%))",
  "hsl(var(--chart-3, 262 83% 58%))",
  "hsl(var(--chart-4, 32 95% 44%))",
  "hsl(var(--chart-5, 346 77% 50%))",
];

function colorFor(series: ChartSeries, index: number) {
  return series.color ?? palette[index % palette.length];
}

function configFor(series: ChartSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map((item, index) => [
      item.key,
      { label: item.label ?? item.key, color: colorFor(item, index) },
    ]),
  );
}

function hasValues(data: AnalyticsChartProps["data"], series: ChartSeries[]) {
  return (
    data.length > 0 &&
    series.some((item) => data.some((row) => typeof row[item.key] === "number"))
  );
}

async function exportSvgAsPng(container: HTMLDivElement, fileName: string) {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Chart is not available for export.");
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originalNodes = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const clonedNodes = [clone, ...Array.from(clone.querySelectorAll("*"))];
  originalNodes.forEach((node, index) => {
    const target = clonedNodes[index] as SVGElement | undefined;
    if (!target) return;
    const style = window.getComputedStyle(node);
    for (const property of [
      "fill",
      "stroke",
      "color",
      "font-family",
      "font-size",
      "font-weight",
      "opacity",
    ])
      target.style.setProperty(property, style.getPropertyValue(property));
  });
  const bounds = svg.getBoundingClientRect();
  clone.setAttribute("width", String(bounds.width));
  clone.setAttribute("height", String(bounds.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bounds.width * scale);
    canvas.height = Math.ceil(bounds.height * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("PNG export is not supported by this browser.");
    context.scale(scale, scale);
    const background = window.getComputedStyle(container).backgroundColor;
    context.fillStyle =
      background === "rgba(0, 0, 0, 0)"
        ? window.getComputedStyle(document.body).backgroundColor
        : background;
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.drawImage(image, 0, 0, bounds.width, bounds.height);
    const link = document.createElement("a");
    link.download = `${fileName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "chart"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function CartesianBase({
  type,
  data,
  series,
  categoryKey,
}: Pick<AnalyticsChartProps, "type" | "data" | "series" | "categoryKey">) {
  const shared = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis
        dataKey={categoryKey ?? "name"}
        axisLine={false}
        tickLine={false}
        tickMargin={8}
      />
      <YAxis axisLine={false} tickLine={false} width={44} />
      <ChartTooltip content={<ChartTooltipContent />} />
    </>
  );
  if (type === "line")
    return (
      <LineChart accessibilityLayer data={data}>
        {shared}
        {series.map((item, index) => (
          <Line
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stroke={colorFor(item, index)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    );
  if (type === "area")
    return (
      <AreaChart accessibilityLayer data={data}>
        {shared}
        {series.map((item, index) => (
          <Area
            key={item.key}
            dataKey={item.key}
            name={item.label}
            type="monotone"
            stroke={colorFor(item, index)}
            fill={colorFor(item, index)}
            fillOpacity={0.18}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    );
  return (
    <BarChart accessibilityLayer data={data}>
      {shared}
      {series.map((item, index) => (
        <Bar
          key={item.key}
          dataKey={item.key}
          name={item.label}
          fill={colorFor(item, index)}
          radius={[4, 4, 0, 0]}
        />
      ))}
    </BarChart>
  );
}

function ChartRenderer(props: AnalyticsChartProps) {
  const {
    type,
    data,
    series,
    categoryKey = "name",
    xKey = "x",
    yKey = "y",
    sizeKey = "value",
    showLegend = true,
  } = props;
  if (type === "line" || type === "area" || type === "bar")
    return <CartesianBase {...props} />;
  if (type === "pie" || type === "donut")
    return (
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey={categoryKey} />} />
        <Pie
          data={data}
          dataKey={series[0]?.key ?? "value"}
          nameKey={categoryKey}
          innerRadius={type === "donut" ? "55%" : 0}
          outerRadius="78%"
          paddingAngle={2}
        >
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={colorFor(
                series[index] ?? series[0] ?? { key: "value" },
                index,
              )}
            />
          ))}
        </Pie>
        {showLegend ? <Legend /> : null}
      </PieChart>
    );
  if (type === "radar")
    return (
      <RadarChart accessibilityLayer data={data} outerRadius="72%">
        <PolarGrid />
        <PolarAngleAxis dataKey={categoryKey} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        {series.map((item, index) => (
          <Radar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stroke={colorFor(item, index)}
            fill={colorFor(item, index)}
            fillOpacity={0.18}
          />
        ))}
        <Tooltip />
        {showLegend ? <Legend /> : null}
      </RadarChart>
    );
  if (type === "scatter" || type === "heatmap")
    return (
      <ScatterChart
        accessibilityLayer
        margin={{ left: 4, right: 16, top: 12, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey={xKey} name={xKey} />
        <YAxis type="number" dataKey={yKey} name={yKey} />
        <ZAxis
          type="number"
          dataKey={sizeKey}
          range={type === "heatmap" ? [180, 180] : [60, 500]}
        />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter
          data={data}
          name={series[0]?.label ?? "Values"}
          fill={colorFor(series[0] ?? { key: sizeKey }, 0)}
          shape={type === "heatmap" ? "square" : "circle"}
        >
          {type === "heatmap"
            ? data.map((row, index) => {
                const value = Number(row[sizeKey] ?? 0);
                const max = Math.max(
                  ...data.map((item) => Number(item[sizeKey] ?? 0)),
                  1,
                );
                return (
                  <Cell
                    key={index}
                    fill={colorFor(series[0] ?? { key: sizeKey }, 0)}
                    fillOpacity={0.15 + (value / max) * 0.85}
                  />
                );
              })
            : null}
        </Scatter>
      </ScatterChart>
    );
  if (type === "funnel")
    return (
      <FunnelChart accessibilityLayer>
        <Tooltip />
        <Funnel
          data={data}
          dataKey={series[0]?.key ?? "value"}
          nameKey={categoryKey}
          isAnimationActive
        >
          <LabelList
            dataKey={categoryKey}
            position="right"
            fill="currentColor"
            stroke="none"
          />
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={colorFor(
                series[index] ?? series[0] ?? { key: "value" },
                index,
              )}
            />
          ))}
        </Funnel>
      </FunnelChart>
    );
  return (
    <Treemap
      data={data}
      dataKey={series[0]?.key ?? "value"}
      nameKey={categoryKey}
      stroke="hsl(var(--background))"
      fill={colorFor(series[0] ?? { key: "value" }, 0)}
    >
      <Tooltip />
    </Treemap>
  );
}

export function AnalyticsChart(props: AnalyticsChartProps) {
  const {
    data,
    series,
    loading = false,
    title,
    description,
    emptyTitle = "No chart data",
    exportFileName = title ?? props.type,
    className,
    height = 320,
  } = props;
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const content = loading ? (
    <div className="space-y-3" style={{ height }} aria-label="Loading chart">
      <Skeleton className="h-full w-full" />
    </div>
  ) : !hasValues(data, series) ? (
    <EmptyState
      compact
      className="border-0"
      style={{ minHeight: height }}
      icon={LineChartIcon}
      title={emptyTitle}
      description="Data will appear here when it becomes available."
    />
  ) : (
    <div ref={chartRef} className="bg-card">
      <ChartContainer
        config={configFor(series)}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <ChartRenderer {...props} />
      </ChartContainer>
    </div>
  );

  async function download() {
    if (!chartRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportSvgAsPng(chartRef.current, exportFileName);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Unable to export chart.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      {title || description ? (
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !hasValues(data, series) || exporting}
            onClick={download}
          >
            <Download className="size-4" />
            {exporting ? "Exporting…" : "PNG"}
          </Button>
        </CardHeader>
      ) : null}
      <CardContent className={cn(!title && !description && "pt-6")}>
        {content}
        {exportError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {exportError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export const LineAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="line" />;
export const AreaAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="area" />;
export const BarAnalyticsChart = (props: Omit<AnalyticsChartProps, "type">) => (
  <AnalyticsChart {...props} type="bar" />
);
export const PieAnalyticsChart = (props: Omit<AnalyticsChartProps, "type">) => (
  <AnalyticsChart {...props} type="pie" />
);
export const DonutAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="donut" />;
export const RadarAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="radar" />;
export const ScatterAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="scatter" />;
export const HeatmapAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="heatmap" />;
export const FunnelAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="funnel" />;
export const TreemapAnalyticsChart = (
  props: Omit<AnalyticsChartProps, "type">,
) => <AnalyticsChart {...props} type="treemap" />;

import "server-only";

import { Prisma } from "@prisma/client";

import type { InferredColumn } from "@/features/datasets/domain/column-types";
import { prisma } from "@/lib/db/prisma";

const businessTerms =
  /\b(revenue|sales|profit|margin|customer|client|product|order|conversion|churn|retention|growth|traffic|report|dataset|dashboard|chart|month|quarter|year|performance|forecast|predict|trend|kpi|analytics|business)\b/i;
export function isBusinessQuestion(question: string) {
  return businessTerms.test(question);
}

type Evidence = {
  scope: string;
  datasets: unknown[];
  computedFindings: unknown[];
  dashboards: unknown[];
  reports: unknown[];
};

export async function buildBusinessContext(
  organizationId: string,
  question: string,
  datasetId?: string,
) {
  const datasets = await prisma.dataset.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: "READY",
      ...(datasetId ? { id: datasetId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: datasetId ? 1 : 3,
    select: {
      id: true,
      name: true,
      rowCount: true,
      schema: true,
      updatedAt: true,
    },
  });
  if (datasetId && !datasets.length) throw new Error("Dataset not found.");
  const computedFindings: unknown[] = [];
  for (const dataset of datasets) {
    const schema = (dataset.schema ?? []) as unknown as InferredColumn[];
    computedFindings.push(
      ...(await profileRelevantColumns(
        dataset.id,
        dataset.name,
        schema,
        question,
      )),
    );
  }
  const [dashboards, reports] = await Promise.all([
    prisma.dashboard.findMany({
      where: { organizationId, deletedAt: null },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        name: true,
        widgets: {
          where: { deletedAt: null, datasetId: { not: null } },
          take: 12,
          select: {
            title: true,
            type: true,
            description: true,
            datasetId: true,
            config: true,
          },
        },
      },
    }),
    prisma.report.findMany({
      where: { organizationId, deletedAt: null },
      take: 10,
      orderBy: { updatedAt: "desc" },
      select: {
        name: true,
        description: true,
        status: true,
        format: true,
        generatedAt: true,
        datasetId: true,
      },
    }),
  ]);
  const evidence: Evidence = {
    scope: "Authorized organization business data only",
    datasets: datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      rowCount: dataset.rowCount?.toString() ?? null,
      columns: ((dataset.schema ?? []) as unknown as InferredColumn[]).map(
        ({ name, type }) => ({ name, type }),
      ),
      updatedAt: dataset.updatedAt,
    })),
    computedFindings,
    dashboards: dashboards.map((dashboard) => ({
      name: dashboard.name,
      widgets: dashboard.widgets.map((widget) => ({
        ...widget,
        config: limitJson(widget.config, 1_500),
      })),
    })),
    reports,
  };
  return JSON.stringify(evidence).slice(0, 24_000);
}

async function profileRelevantColumns(
  datasetId: string,
  datasetName: string,
  schema: InferredColumn[],
  question: string,
) {
  const words = new Set(question.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const relevant = schema
    .filter(
      (column) =>
        words.has(column.name.toLowerCase()) ||
        [...words].some(
          (word) => word.length > 3 && column.name.toLowerCase().includes(word),
        ),
    )
    .slice(0, 8);
  const fallback = schema
    .filter((column) =>
      ["integer", "number", "date", "datetime"].includes(column.type),
    )
    .slice(0, 4);
  const columns = relevant.length ? relevant : fallback;
  const findings: unknown[] = [];
  for (const column of columns) {
    if (column.type === "integer" || column.type === "number") {
      const raw = Prisma.sql`"data" ->> ${column.name}`;
      const numeric = Prisma.sql`CASE WHEN ${raw} ~ ${"^[-+]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)$"} THEN (${raw})::numeric END`;
      const rows = await prisma.$queryRaw<
        Array<{
          count: number;
          min: number | null;
          max: number | null;
          average: number | null;
          total: number | null;
        }>
      >(
        Prisma.sql`SELECT COUNT(${numeric})::int count, MIN(${numeric})::float min, MAX(${numeric})::float max, AVG(${numeric})::float average, SUM(${numeric})::float total FROM "DatasetRow" WHERE "datasetId"=${datasetId}::uuid`,
      );
      findings.push({
        dataset: datasetName,
        column: column.name,
        statistic: "full_dataset_numeric_profile",
        ...rows[0],
      });
    } else {
      const rows = await prisma.$queryRaw<
        Array<{ value: string; count: number }>
      >(
        Prisma.sql`SELECT "data" ->> ${column.name} value, COUNT(*)::int count FROM "DatasetRow" WHERE "datasetId"=${datasetId}::uuid AND NULLIF("data" ->> ${column.name}, '') IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      );
      findings.push({
        dataset: datasetName,
        column: column.name,
        statistic: "top_values_by_row_count",
        values: rows,
      });
    }
  }
  const metric = schema.find(
    (column) =>
      /revenue|sales|profit/i.test(column.name) &&
      ["integer", "number"].includes(column.type),
  );
  const date = schema.find((column) =>
    ["date", "datetime"].includes(column.type),
  );
  if (
    metric &&
    date &&
    /month|trend|forecast|predict|decrease|increase/i.test(question)
  ) {
    const rawMetric = Prisma.sql`"data" ->> ${metric.name}`;
    const numeric = Prisma.sql`CASE WHEN ${rawMetric} ~ ${"^[-+]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)$"} THEN (${rawMetric})::numeric END`;
    const rawDate = Prisma.sql`"data" ->> ${date.name}`;
    const rows = await prisma.$queryRaw<Array<{ month: Date; value: number }>>(
      Prisma.sql`SELECT DATE_TRUNC('month', (${rawDate})::timestamptz) month, SUM(${numeric})::float value FROM "DatasetRow" WHERE "datasetId"=${datasetId}::uuid AND ${rawDate} ~ ${"^[0-9]{4}-[0-9]{2}-[0-9]{2}"} GROUP BY 1 ORDER BY 1 DESC LIMIT 24`,
    );
    rows.reverse();
    const finding: Record<string, unknown> = {
      dataset: datasetName,
      statistic: `monthly_${metric.name}`,
      values: rows,
    };
    if (/forecast|predict/i.test(question) && rows.length >= 3)
      finding.nextMonthLinearTrend = linearForecast(
        rows.map((row) => row.value),
      );
    findings.push(finding);
  }
  const category = schema.find((column) =>
    /product|customer|client/i.test(column.name),
  );
  if (category && metric && /best|top|highest|perform/i.test(question)) {
    const raw = Prisma.sql`"data" ->> ${metric.name}`;
    const numeric = Prisma.sql`CASE WHEN ${raw} ~ ${"^[-+]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)$"} THEN (${raw})::numeric ELSE 0 END`;
    const rows = await prisma.$queryRaw<
      Array<{ category: string; value: number }>
    >(
      Prisma.sql`SELECT "data" ->> ${category.name} category, SUM(${numeric})::float value FROM "DatasetRow" WHERE "datasetId"=${datasetId}::uuid GROUP BY 1 ORDER BY 2 DESC NULLS LAST LIMIT 10`,
    );
    findings.push({
      dataset: datasetName,
      statistic: `${category.name}_ranked_by_${metric.name}`,
      values: rows,
    });
  }
  return findings;
}
function linearForecast(values: number[]) {
  const n = values.length;
  const sx = (n * (n - 1)) / 2;
  const sy = values.reduce((a, b) => a + b, 0);
  const sxy = values.reduce((sum, value, x) => sum + x * value, 0);
  const sx2 = values.reduce((sum, _, x) => sum + x * x, 0);
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  return Math.round(((sy - slope * sx) / n + slope * n) * 100) / 100;
}
function limitJson(value: unknown, max: number) {
  const json = JSON.stringify(value);
  return json.length <= max ? value : `${json.slice(0, max)}…`;
}

import "server-only";

import { Prisma } from "@prisma/client";

import type { InferredColumn } from "@/features/datasets/domain/column-types";
import type { InsightRequest } from "@/features/ai-insights/schemas/insight-schema";
import { prisma } from "@/lib/db/prisma";

export type BusinessStatistics = {
  period: {
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
  revenue: { current: number; previous: number; growthPercent: number | null };
  customers?: {
    current: number;
    previous: number;
    growthPercent: number | null;
  };
  topProduct?: { name: string; revenue: number };
  churnPercent?: number;
  weekendVsWeekdayPercent?: number | null;
};

export async function calculateStatistics(
  datasetId: string,
  schema: InferredColumn[],
  mapping: InsightRequest["mapping"],
): Promise<BusinessStatistics> {
  const known = new Set(schema.map((column) => column.name));
  Object.values(mapping)
    .filter(Boolean)
    .forEach((column) => {
      if (!known.has(column!))
        throw new Error(`Unknown dataset column: ${column}`);
    });
  const date = Prisma.sql`CASE WHEN ("data" ->> ${mapping.date}) ~ ${"^[0-9]{4}-[0-9]{2}-[0-9]{2}"} THEN ("data" ->> ${mapping.date})::timestamptz END`;
  const revenue = Prisma.sql`CASE WHEN ("data" ->> ${mapping.revenue}) ~ ${"^[-+]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)$"} THEN ("data" ->> ${mapping.revenue})::numeric ELSE 0 END`;
  const bounds = await prisma.$queryRaw<Array<{ max: Date | null }>>(
    Prisma.sql`SELECT MAX(${date}) AS max FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid`,
  );
  const currentEnd = bounds[0]?.max;
  if (!currentEnd)
    throw new Error("The selected date column contains no valid dates.");
  const currentStart = new Date(currentEnd);
  currentStart.setUTCDate(currentStart.getUTCDate() - 29);
  currentStart.setUTCHours(0, 0, 0, 0);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - 30);
  const totals = await prisma.$queryRaw<
    Array<{ current: number; previous: number }>
  >(
    Prisma.sql`SELECT COALESCE(SUM(${revenue}) FILTER (WHERE ${date} BETWEEN ${currentStart} AND ${currentEnd}),0)::float AS current, COALESCE(SUM(${revenue}) FILTER (WHERE ${date} BETWEEN ${previousStart} AND ${previousEnd}),0)::float AS previous FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid`,
  );
  const result: BusinessStatistics = {
    period: {
      currentStart: currentStart.toISOString(),
      currentEnd: currentEnd.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString(),
    },
    revenue: metric(totals[0]?.current ?? 0, totals[0]?.previous ?? 0),
  };
  if (mapping.customerId) {
    const customer = Prisma.sql`NULLIF("data" ->> ${mapping.customerId}, '')`;
    const values = await prisma.$queryRaw<
      Array<{ current: number; previous: number }>
    >(
      Prisma.sql`SELECT COUNT(DISTINCT ${customer}) FILTER (WHERE ${date} BETWEEN ${currentStart} AND ${currentEnd})::int AS current, COUNT(DISTINCT ${customer}) FILTER (WHERE ${date} BETWEEN ${previousStart} AND ${previousEnd})::int AS previous FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid`,
    );
    result.customers = metric(
      values[0]?.current ?? 0,
      values[0]?.previous ?? 0,
    );
  }
  if (mapping.product) {
    const top = await prisma.$queryRaw<
      Array<{ name: string; revenue: number }>
    >(
      Prisma.sql`SELECT "data" ->> ${mapping.product} AS name, SUM(${revenue})::float AS revenue FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid AND ${date} BETWEEN ${currentStart} AND ${currentEnd} GROUP BY 1 ORDER BY 2 DESC NULLS LAST LIMIT 1`,
    );
    if (top[0]?.name) result.topProduct = top[0];
  }
  if (mapping.churned) {
    const values = await prisma.$queryRaw<Array<{ churn: number }>>(
      Prisma.sql`SELECT COALESCE(100.0 * COUNT(*) FILTER (WHERE LOWER("data" ->> ${mapping.churned}) IN ('true','yes','1')) / NULLIF(COUNT(*),0),0)::float AS churn FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid AND ${date} BETWEEN ${currentStart} AND ${currentEnd}`,
    );
    result.churnPercent = round(values[0]?.churn ?? 0);
  }
  const day = await prisma.$queryRaw<
    Array<{ weekend: number | null; weekday: number | null }>
  >(
    Prisma.sql`WITH daily AS (SELECT (${date})::date d, SUM(${revenue}) amount FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid AND ${date} BETWEEN ${currentStart} AND ${currentEnd} GROUP BY 1) SELECT AVG(amount) FILTER (WHERE EXTRACT(ISODOW FROM d) IN (6,7))::float weekend, AVG(amount) FILTER (WHERE EXTRACT(ISODOW FROM d) NOT IN (6,7))::float weekday FROM daily`,
  );
  result.weekendVsWeekdayPercent = growth(
    day[0]?.weekend ?? 0,
    day[0]?.weekday ?? 0,
  );
  return result;
}
function metric(current: number, previous: number) {
  return {
    current: round(current),
    previous: round(previous),
    growthPercent: growth(current, previous),
  };
}
function growth(current: number, previous: number) {
  return previous === 0
    ? null
    : round(((current - previous) / Math.abs(previous)) * 100);
}
const round = (value: number) => Math.round(value * 100) / 100;

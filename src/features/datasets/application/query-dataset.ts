import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import type {
  ColumnType,
  InferredColumn,
} from "@/features/datasets/domain/column-types";
import type { DatasetQueryInput } from "@/features/datasets/schemas/dataset-query-schema";
import { prisma } from "@/lib/db/prisma";
import { cacheGet, cacheSet } from "@/lib/cache/cache";

type QueryResult = {
  rows: unknown[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  grouped: boolean;
};

export async function queryDataset(
  datasetId: string,
  schema: InferredColumn[],
  input: DatasetQueryInput,
) {
  const startedAt = performance.now();
  const queryHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const redisKey = `dataset-query:${datasetId}:${queryHash}`;
  if (input.cacheTtlSeconds > 0) {
    const cached = await cacheGet<QueryResult>(redisKey);
    if (cached)
      return {
        ...cached,
        cached: true,
        cacheLayer: "redis-or-memory" as const,
        queryMs: Math.round(performance.now() - startedAt),
      };
  }
  if (input.cacheTtlSeconds > 0) {
    const cached = await prisma.datasetQueryCache.findUnique({
      where: { datasetId_queryHash: { datasetId, queryHash } },
    });
    if (cached && cached.expiresAt > new Date()) {
      await cacheSet(redisKey, cached.result, input.cacheTtlSeconds);
      return {
        ...(cached.result as QueryResult),
        cached: true,
        queryMs: Math.round(performance.now() - startedAt),
      };
    }
  }

  const columnTypes = new Map(
    schema.map((column) => [column.name, column.type]),
  );
  const assertColumn = (column: string) => {
    const type = columnTypes.get(column);
    if (!type) throw new DatasetQueryError(`Unknown column: ${column}`);
    return type;
  };
  input.columns?.forEach(assertColumn);
  input.filters.forEach((filter) => assertColumn(filter.column));
  input.search?.columns?.forEach(assertColumn);
  input.groupBy.forEach(assertColumn);
  input.aggregations.forEach((aggregation) => {
    if (aggregation.function !== "count" && !aggregation.column)
      throw new DatasetQueryError(`${aggregation.function} requires a column.`);
    if (aggregation.column) assertColumn(aggregation.column);
  });

  const where = buildWhere(input, columnTypes, assertColumn);
  const grouped = input.groupBy.length > 0 || input.aggregations.length > 0;
  const offset = (input.page - 1) * input.pageSize;
  const { select, groupBy, countGroupBy, orderBy } = grouped
    ? buildGroupedQuery(input, columnTypes, assertColumn)
    : buildRowQuery(input, columnTypes, assertColumn);

  const countQuery = grouped
    ? input.groupBy.length
      ? Prisma.sql`SELECT COUNT(*)::int AS "count" FROM (SELECT 1 FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid ${where} ${countGroupBy}) AS groups`
      : Prisma.sql`SELECT 1::int AS "count"`
    : Prisma.sql`SELECT COUNT(*)::int AS "count" FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid ${where}`;
  const dataQuery = Prisma.sql`${select} FROM "DatasetRow" WHERE "datasetId" = ${datasetId}::uuid ${where} ${groupBy} ${orderBy} LIMIT ${input.pageSize} OFFSET ${offset}`;
  const [rawRows, counts] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>(dataQuery),
    prisma.$queryRaw<Array<{ count: number }>>(countQuery),
  ]);
  const total = counts[0]?.count ?? 0;
  const rows = rawRows.map((row) => ({
    ...row,
    rowNumber:
      typeof row.rowNumber === "bigint"
        ? row.rowNumber.toString()
        : row.rowNumber,
  }));
  const result: QueryResult = {
    rows,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    },
    grouped,
  };

  if (input.cacheTtlSeconds > 0) {
    await cacheSet(redisKey, result, input.cacheTtlSeconds);
    await prisma.datasetQueryCache.upsert({
      where: { datasetId_queryHash: { datasetId, queryHash } },
      create: {
        datasetId,
        queryHash,
        result: result as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + input.cacheTtlSeconds * 1_000),
      },
      update: {
        result: result as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + input.cacheTtlSeconds * 1_000),
      },
    });
    void prisma.datasetQueryCache
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => undefined);
  }
  return {
    ...result,
    cached: false,
    queryMs: Math.round(performance.now() - startedAt),
  };
}

function buildWhere(
  input: DatasetQueryInput,
  columnTypes: Map<string, ColumnType>,
  assertColumn: (column: string) => ColumnType,
) {
  const clauses: Prisma.Sql[] = [];
  for (const filter of input.filters) {
    const type = assertColumn(filter.column);
    const expression = typedValue(filter.column, type);
    const stringExpression = rawValue(filter.column);
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    switch (filter.operator) {
      case "eq":
        clauses.push(
          Prisma.sql`${expression} = ${typedParameter(values[0], type)}`,
        );
        break;
      case "neq":
        clauses.push(
          Prisma.sql`${expression} IS DISTINCT FROM ${typedParameter(values[0], type)}`,
        );
        break;
      case "gt":
        clauses.push(
          Prisma.sql`${expression} > ${typedParameter(values[0], type)}`,
        );
        break;
      case "gte":
        clauses.push(
          Prisma.sql`${expression} >= ${typedParameter(values[0], type)}`,
        );
        break;
      case "lt":
        clauses.push(
          Prisma.sql`${expression} < ${typedParameter(values[0], type)}`,
        );
        break;
      case "lte":
        clauses.push(
          Prisma.sql`${expression} <= ${typedParameter(values[0], type)}`,
        );
        break;
      case "contains":
        clauses.push(
          Prisma.sql`${stringExpression} ILIKE ${`%${String(values[0] ?? "")}%`}`,
        );
        break;
      case "startsWith":
        clauses.push(
          Prisma.sql`${stringExpression} ILIKE ${`${String(values[0] ?? "")}%`}`,
        );
        break;
      case "endsWith":
        clauses.push(
          Prisma.sql`${stringExpression} ILIKE ${`%${String(values[0] ?? "")}`}`,
        );
        break;
      case "in":
        clauses.push(
          Prisma.sql`${expression} IN (${Prisma.join(values.map((value) => typedParameter(value, type)))})`,
        );
        break;
      case "between":
        if (values.length !== 2)
          throw new DatasetQueryError(
            "Between filters require exactly two values.",
          );
        clauses.push(
          Prisma.sql`${expression} BETWEEN ${typedParameter(values[0], type)} AND ${typedParameter(values[1], type)}`,
        );
        break;
      case "isNull":
        clauses.push(
          Prisma.sql`(${stringExpression} IS NULL OR ${stringExpression} = '')`,
        );
        break;
      case "isNotNull":
        clauses.push(
          Prisma.sql`(${stringExpression} IS NOT NULL AND ${stringExpression} <> '')`,
        );
        break;
    }
  }
  if (input.search) {
    const searchColumns = input.search.columns?.length
      ? input.search.columns
      : [...columnTypes.keys()];
    clauses.push(
      Prisma.sql`(${Prisma.join(
        searchColumns.map(
          (column) =>
            Prisma.sql`${rawValue(column)} ILIKE ${`%${input.search!.query}%`}`,
        ),
        " OR ",
      )})`,
    );
  }
  return clauses.length
    ? Prisma.sql`AND ${Prisma.join(clauses, " AND ")}`
    : Prisma.empty;
}

function buildRowQuery(
  input: DatasetQueryInput,
  columnTypes: Map<string, ColumnType>,
  assertColumn: (column: string) => ColumnType,
) {
  const columns = input.columns?.length
    ? input.columns
    : [...columnTypes.keys()];
  const pairs = columns.flatMap((column) => [
    Prisma.sql`${column}`,
    rawValue(column),
  ]);
  const select = Prisma.sql`SELECT "rowNumber", jsonb_build_object(${Prisma.join(pairs)}) AS "values"`;
  const sorting = input.sort.length
    ? input.sort
    : [{ column: "__rowNumber", direction: "asc" as const }];
  const orderParts = sorting.map((sort) => {
    if (sort.column === "__rowNumber")
      return Prisma.sql`"rowNumber" ${Prisma.raw(sort.direction.toUpperCase())}`;
    const type = assertColumn(sort.column);
    return Prisma.sql`${typedValue(sort.column, type)} ${Prisma.raw(sort.direction.toUpperCase())} NULLS LAST`;
  });
  return {
    select,
    groupBy: Prisma.empty,
    countGroupBy: Prisma.empty,
    orderBy: Prisma.sql`ORDER BY ${Prisma.join(orderParts)}`,
  };
}

function buildGroupedQuery(
  input: DatasetQueryInput,
  columnTypes: Map<string, ColumnType>,
  assertColumn: (column: string) => ColumnType,
) {
  if (!input.aggregations.length)
    throw new DatasetQueryError(
      "Grouped queries require at least one aggregation.",
    );
  const groupExpressions = input.groupBy.map((column) =>
    typedValue(column, assertColumn(column)),
  );
  const groupPairs = input.groupBy.flatMap((column, index) => [
    Prisma.sql`${column}`,
    groupExpressions[index]!,
  ]);
  const aggregationExpressions = new Map<string, Prisma.Sql>();
  for (const aggregation of input.aggregations) {
    const expression = aggregation.column
      ? typedValue(aggregation.column, assertColumn(aggregation.column))
      : Prisma.sql`*`;
    if (["sum", "avg"].includes(aggregation.function) && aggregation.column) {
      const type = assertColumn(aggregation.column);
      if (type !== "integer" && type !== "number")
        throw new DatasetQueryError(
          `${aggregation.function} requires a numeric column.`,
        );
    }
    aggregationExpressions.set(
      aggregation.alias,
      aggregation.function === "count" && !aggregation.column
        ? Prisma.sql`COUNT(*)::int`
        : Prisma.sql`${Prisma.raw(aggregation.function.toUpperCase())}(${expression})`,
    );
  }
  const aggregationPairs = [...aggregationExpressions].flatMap(
    ([alias, expression]) => [Prisma.sql`${alias}`, expression],
  );
  const groupObject = groupPairs.length
    ? Prisma.sql`jsonb_build_object(${Prisma.join(groupPairs)})`
    : Prisma.sql`'{}'::jsonb`;
  const select = Prisma.sql`SELECT ${groupObject} AS "group", jsonb_build_object(${Prisma.join(aggregationPairs)}) AS "aggregations"`;
  const groupBy = groupExpressions.length
    ? Prisma.sql`GROUP BY 1`
    : Prisma.empty;
  const countGroupBy = groupExpressions.length
    ? Prisma.sql`GROUP BY ${Prisma.join(groupExpressions)}`
    : Prisma.empty;
  const orderParts = input.sort.map((sort) => {
    const aggregate = aggregationExpressions.get(sort.column);
    if (aggregate)
      return Prisma.sql`${aggregate} ${Prisma.raw(sort.direction.toUpperCase())} NULLS LAST`;
    const groupIndex = input.groupBy.indexOf(sort.column);
    if (groupIndex < 0)
      throw new DatasetQueryError(
        `Grouped sorting must use a group column or aggregation alias: ${sort.column}`,
      );
    return Prisma.sql`MIN(${groupExpressions[groupIndex]!}) ${Prisma.raw(sort.direction.toUpperCase())} NULLS LAST`;
  });
  return {
    select,
    groupBy,
    countGroupBy,
    orderBy: orderParts.length
      ? Prisma.sql`ORDER BY ${Prisma.join(orderParts)}`
      : Prisma.empty,
  };
}

function rawValue(column: string) {
  return Prisma.sql`"data" ->> ${column}`;
}

function typedValue(column: string, type: ColumnType) {
  const value = rawValue(column);
  if (type === "integer" || type === "number")
    return Prisma.sql`CASE WHEN ${value} ~ ${"^[-+]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$"} THEN (${value})::numeric END`;
  if (type === "boolean")
    return Prisma.sql`CASE WHEN LOWER(${value}) IN ('true','yes','1') THEN TRUE WHEN LOWER(${value}) IN ('false','no','0') THEN FALSE END`;
  if (type === "date")
    return Prisma.sql`CASE WHEN ${value} ~ ${"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"} THEN (${value})::date END`;
  if (type === "datetime")
    return Prisma.sql`CASE WHEN ${value} ~ ${"^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]"} THEN (${value})::timestamptz END`;
  return value;
}

function typedParameter(value: unknown, type: ColumnType) {
  if (value === null || value === undefined) return Prisma.sql`NULL`;
  if (type === "integer" || type === "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
      throw new DatasetQueryError(`Invalid numeric value: ${String(value)}`);
    return Prisma.sql`${numeric}::numeric`;
  }
  if (type === "boolean") {
    const normalized = String(value).toLowerCase();
    if (!["true", "false", "yes", "no", "1", "0"].includes(normalized))
      throw new DatasetQueryError(`Invalid boolean value: ${String(value)}`);
    return Prisma.sql`${["true", "yes", "1"].includes(normalized)}`;
  }
  if (type === "date") return Prisma.sql`${String(value)}::date`;
  if (type === "datetime") return Prisma.sql`${String(value)}::timestamptz`;
  return Prisma.sql`${String(value)}`;
}

export class DatasetQueryError extends Error {}

import { z } from "zod";

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const datasetFilterSchema = z.object({
  column: z.string().min(1).max(255),
  operator: z.enum([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "startsWith",
    "endsWith",
    "in",
    "between",
    "isNull",
    "isNotNull",
  ]),
  value: z
    .union([scalarSchema, z.array(scalarSchema).min(1).max(100)])
    .optional(),
});

export const datasetQuerySchema = z.object({
  columns: z.array(z.string().min(1).max(255)).max(100).optional(),
  filters: z.array(datasetFilterSchema).max(50).default([]),
  search: z
    .object({
      query: z.string().trim().min(1).max(200),
      columns: z.array(z.string()).max(50).optional(),
    })
    .optional(),
  sort: z
    .array(
      z.object({
        column: z.string(),
        direction: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .max(5)
    .default([]),
  groupBy: z.array(z.string()).max(5).default([]),
  aggregations: z
    .array(
      z.object({
        function: z.enum(["count", "sum", "avg", "min", "max"]),
        column: z.string().optional(),
        alias: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
      }),
    )
    .max(20)
    .default([]),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  cacheTtlSeconds: z.number().int().min(0).max(3600).default(60),
});

export type DatasetQueryInput = z.infer<typeof datasetQuerySchema>;

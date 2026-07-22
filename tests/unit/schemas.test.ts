import { ReportFormat } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "@/features/ai-assistant/schemas/chat-schema";
import { insightRequestSchema } from "@/features/ai-insights/schemas/insight-schema";
import {
  createCsvUploadSchema,
  MAX_CSV_BYTES,
} from "@/features/datasets/schemas/csv-upload-schema";
import { datasetQuerySchema } from "@/features/datasets/schemas/dataset-query-schema";
import {
  reportInputSchema,
  runReportSchema,
} from "@/features/reports/schemas/report-schema";

const id = "7d694c9c-8d30-4d5b-b9c3-a89ef85a1a30";
describe("request schemas", () => {
  it("normalizes valid CSV metadata", () =>
    expect(
      createCsvUploadSchema.parse({
        organizationId: id,
        fileName: " sales.CSV ",
        sizeBytes: 12,
      }).mimeType,
    ).toBe("text/csv"));
  it.each([
    { organizationId: id, fileName: "data.txt", sizeBytes: 1 },
    { organizationId: id, fileName: "data.csv", sizeBytes: 0 },
    { organizationId: id, fileName: "data.csv", sizeBytes: MAX_CSV_BYTES + 1 },
  ])("rejects invalid CSV metadata", (value) =>
    expect(createCsvUploadSchema.safeParse(value).success).toBe(false),
  );
  it("applies dataset query defaults", () =>
    expect(datasetQuerySchema.parse({})).toMatchObject({
      filters: [],
      sort: [],
      groupBy: [],
      aggregations: [],
      page: 1,
      pageSize: 50,
      cacheTtlSeconds: 60,
    }));
  it("accepts a complex dataset query", () =>
    expect(
      datasetQuerySchema.safeParse({
        columns: ["revenue"],
        filters: [{ column: "revenue", operator: "between", value: [1, 10] }],
        search: { query: "pro" },
        sort: [{ column: "revenue", direction: "desc" }],
        groupBy: ["product"],
        aggregations: [
          { function: "sum", column: "revenue", alias: "totalRevenue" },
        ],
        page: 2,
        pageSize: 100,
      }).success,
    ).toBe(true));
  it("rejects excessive query page sizes", () =>
    expect(datasetQuerySchema.safeParse({ pageSize: 201 }).success).toBe(
      false,
    ));
  it("accepts reports, schedules, and templates", () =>
    expect(
      reportInputSchema.parse({
        organizationId: id,
        name: "Monthly sales",
        datasetId: id,
        format: ReportFormat.CSV,
        saveAsTemplate: true,
        schedule: { frequency: "weekly", recipients: ["owner@example.com"] },
      }),
    ).toMatchObject({ columns: [], saveAsTemplate: true }));
  it("validates report run recipients", () =>
    expect(runReportSchema.safeParse({ recipients: ["invalid"] }).success).toBe(
      false,
    ));
  it("requires exactly one chat operation", () => {
    expect(
      chatRequestSchema.safeParse({
        organizationId: id,
        question: "Revenue trend?",
      }).success,
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({
        organizationId: id,
        regenerateMessageId: id,
      }).success,
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({
        organizationId: id,
        question: "Revenue",
        regenerateMessageId: id,
      }).success,
    ).toBe(false);
    expect(chatRequestSchema.safeParse({ organizationId: id }).success).toBe(
      false,
    );
  });
  it("validates insight column mappings", () =>
    expect(
      insightRequestSchema.safeParse({
        organizationId: id,
        datasetId: id,
        mapping: { date: "date", revenue: "revenue", customerId: "customer" },
      }).success,
    ).toBe(true));
});

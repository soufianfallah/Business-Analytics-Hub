import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

import { queryDataset } from "../src/features/datasets/application/query-dataset";
import { datasetQuerySchema } from "../src/features/datasets/schemas/dataset-query-schema";
import { prisma } from "../src/lib/db/prisma";

const suffix = randomUUID().slice(0, 8);
const userId = randomUUID();
const organizationId = randomUUID();
const datasetId = randomUUID();
const schema = [
  { name: "region", type: "string" as const, nullable: false },
  { name: "city", type: "string" as const, nullable: false },
  { name: "revenue", type: "number" as const, nullable: false },
  { name: "order_date", type: "date" as const, nullable: false },
];

async function main() {
  try {
    await prisma.user.create({
      data: {
        id: userId,
        name: "Dataset Test",
        email: `dataset-${suffix}@example.test`,
        emailVerified: true,
      },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Dataset Test",
        slug: `dataset-test-${suffix}`,
      },
    });
    await prisma.dataset.create({
      data: {
        id: datasetId,
        organizationId,
        createdById: userId,
        name: "Sales",
        sourceType: "CSV_UPLOAD",
        status: "READY",
        schema,
      },
    });
    await prisma.datasetRow.createMany({
      data: [
        {
          datasetId,
          rowNumber: BigInt(1),
          data: {
            region: "North",
            city: "Casablanca",
            revenue: "100",
            order_date: "2026-01-15",
          },
        },
        {
          datasetId,
          rowNumber: BigInt(2),
          data: {
            region: "North",
            city: "Casablanca",
            revenue: "200.5",
            order_date: "2026-02-20",
          },
        },
        {
          datasetId,
          rowNumber: BigInt(3),
          data: {
            region: "South",
            city: "Agadir",
            revenue: "75",
            order_date: "2025-12-31",
          },
        },
      ],
    });

    const rowQuery = datasetQuerySchema.parse({
      columns: ["city", "revenue"],
      filters: [
        { column: "revenue", operator: "gte", value: 100 },
        {
          column: "order_date",
          operator: "between",
          value: ["2026-01-01", "2026-12-31"],
        },
      ],
      search: { query: "Casa", columns: ["city"] },
      sort: [{ column: "revenue", direction: "desc" }],
      page: 1,
      pageSize: 1,
      cacheTtlSeconds: 60,
    });
    const first = await queryDataset(datasetId, schema, rowQuery);
    assert.equal(first.pagination.total, 2);
    assert.equal(first.pagination.totalPages, 2);
    assert.equal(
      (first.rows[0] as { values: { revenue: string } }).values.revenue,
      "200.5",
    );
    assert.equal(first.cached, false);

    const cached = await queryDataset(datasetId, schema, rowQuery);
    assert.equal(cached.cached, true);

    const grouped = await queryDataset(
      datasetId,
      schema,
      datasetQuerySchema.parse({
        groupBy: ["region"],
        aggregations: [
          { function: "sum", column: "revenue", alias: "totalRevenue" },
          { function: "count", alias: "orders" },
        ],
        sort: [{ column: "totalRevenue", direction: "desc" }],
        pageSize: 10,
        cacheTtlSeconds: 0,
      }),
    );
    assert.equal(grouped.grouped, true);
    assert.equal(grouped.pagination.total, 2);
    assert.deepEqual((grouped.rows[0] as { group: unknown }).group, {
      region: "North",
    });
    assert.deepEqual(
      (grouped.rows[0] as { aggregations: unknown }).aggregations,
      { orders: 2, totalRevenue: 300.5 },
    );

    console.log("Dataset engine integration test passed.");
  } finally {
    await prisma.organization
      .delete({ where: { id: organizationId } })
      .catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

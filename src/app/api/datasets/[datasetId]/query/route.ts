import { NextRequest, NextResponse } from "next/server";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import {
  DatasetQueryError,
  queryDataset,
} from "@/features/datasets/application/query-dataset";
import type { InferredColumn } from "@/features/datasets/domain/column-types";
import { datasetQuerySchema } from "@/features/datasets/schemas/dataset-query-schema";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { datasetId } = await params;
    const input = datasetQuerySchema.parse(await request.json());
    const dataset = await prisma.dataset.findFirst({
      where: { id: datasetId, deletedAt: null },
      select: { id: true, organizationId: true, status: true, schema: true },
    });
    if (!dataset)
      return NextResponse.json(
        { error: "Dataset not found." },
        { status: 404 },
      );
    const session = await requireOrganizationPermission(
      dataset.organizationId,
      {
        dataset: ["read"],
      },
    );
    if (dataset.status !== "READY")
      return NextResponse.json(
        { error: "Dataset is not ready for queries." },
        { status: 409 },
      );
    const schema = parseDatasetSchema(dataset.schema);
    const result = await queryDataset(dataset.id, schema, input);
    await safeRecordAudit({
      organizationId: dataset.organizationId,
      userId: session.user.id,
      action: "READ",
      entityType: "Dataset",
      entityId: dataset.id,
      description: "Dataset queried",
      changes: {
        columns: input.columns,
        filters: input.filters.map(({ column, operator }) => ({
          column,
          operator,
        })),
        groupedBy: input.groupBy,
        aggregations: input.aggregations.map(
          ({ function: operation, column, alias }) => ({
            operation,
            column,
            alias,
          }),
        ),
        page: input.page,
        pageSize: input.pageSize,
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dataset query failed.";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
          ? 403
          : error instanceof DatasetQueryError
            ? 400
            : 422;
    return NextResponse.json({ error: message }, { status });
  }
}

function parseDatasetSchema(value: unknown): InferredColumn[] {
  if (!Array.isArray(value))
    throw new DatasetQueryError("Dataset schema is unavailable.");
  return value.filter(
    (column): column is InferredColumn =>
      typeof column === "object" &&
      column !== null &&
      "name" in column &&
      "type" in column,
  ) as InferredColumn[];
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}

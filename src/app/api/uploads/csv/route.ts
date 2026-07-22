import { NextRequest, NextResponse } from "next/server";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import {
  assertWithinUsageLimit,
  UsageLimitError,
} from "@/features/billing/application/usage-limits";
import { createCsvUploadSchema } from "@/features/datasets/schemas/csv-upload-schema";
import { csvStorageKey } from "@/features/datasets/infrastructure/csv-storage";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = createCsvUploadSchema.parse(await request.json());
    const session = await requireOrganizationPermission(input.organizationId, {
      dataset: ["create"],
    });
    await assertWithinUsageLimit(input.organizationId, "datasets");
    await assertWithinUsageLimit(
      input.organizationId,
      "storageBytes",
      input.sizeBytes,
    );
    const uploadId = crypto.randomUUID();
    const upload = await prisma.csvUpload.create({
      data: {
        id: uploadId,
        organizationId: input.organizationId,
        uploadedById: session.user.id,
        originalName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        storageKey: csvStorageKey(uploadId),
        status: "PENDING",
      },
    });
    await safeRecordAudit({
      organizationId: input.organizationId,
      userId: session.user.id,
      action: "UPLOAD",
      entityType: "CsvUpload",
      entityId: upload.id,
      description: "CSV upload initialized",
      changes: {
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json(
      { uploadId: upload.id, uploadUrl: `/api/uploads/csv/${upload.id}` },
      { status: 201 },
    );
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}

function uploadErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to create upload.";
  const status =
    message === "UNAUTHENTICATED"
      ? 401
      : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
        ? 403
        : error instanceof UsageLimitError
          ? 402
          : 400;
  return NextResponse.json({ error: message }, { status });
}

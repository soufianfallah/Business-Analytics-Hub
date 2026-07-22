import { createHash } from "node:crypto";
import { Transform } from "node:stream";

import {
  DatasetSourceType,
  DatasetStatus,
  CsvUploadStatus,
  Prisma,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import { analyzeCsv } from "@/features/datasets/application/analyze-csv";
import { storeCsvRows } from "@/features/datasets/application/store-csv-rows";
import {
  removeCsv,
  writeCsvStream,
} from "@/features/datasets/infrastructure/csv-storage";
import { MAX_CSV_BYTES } from "@/features/datasets/schemas/csv-upload-schema";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const { uploadId } = await params;
  let upload: Awaited<ReturnType<typeof prisma.csvUpload.findUnique>>;
  let createdDatasetId: string | undefined;
  try {
    assertSameOrigin(request);
    upload = await prisma.csvUpload.findUnique({ where: { id: uploadId } });
    if (!upload)
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    const session = await requireOrganizationPermission(upload.organizationId, {
      dataset: ["create"],
    });
    if (upload.uploadedById !== session.user.id)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!request.body)
      return NextResponse.json(
        { error: "The upload body is empty." },
        { status: 400 },
      );
    if (
      upload.status !== CsvUploadStatus.PENDING &&
      upload.status !== CsvUploadStatus.FAILED
    ) {
      return NextResponse.json(
        { error: "This upload cannot be replaced in its current state." },
        { status: 409 },
      );
    }
    if (upload.status === CsvUploadStatus.FAILED) await removeCsv(uploadId);

    const expectedBytes = Number(upload.sizeBytes);
    if (expectedBytes > MAX_CSV_BYTES)
      return NextResponse.json(
        { error: "File exceeds the 2 GB limit." },
        { status: 413 },
      );
    await prisma.csvUpload.update({
      where: { id: uploadId },
      data: {
        status: CsvUploadStatus.UPLOADING,
        startedAt: new Date(),
        errorDetails: Prisma.JsonNull,
      },
    });

    let receivedBytes = 0;
    const hash = createHash("sha256");
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        receivedBytes += chunk.length;
        if (receivedBytes > expectedBytes || receivedBytes > MAX_CSV_BYTES)
          return callback(new Error("UPLOAD_SIZE_MISMATCH"));
        if (chunk.includes(0)) return callback(new Error("CSV_BINARY_CONTENT"));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    const bodyStream = request.body
      .pipeThrough(new TransformStream())
      .getReader();
    const readable = new (await import("node:stream")).Readable({
      async read() {
        const { done, value } = await bodyStream.read();
        if (done) this.push(null);
        else this.push(Buffer.from(value));
      },
    });
    await writeCsvStream(uploadId, readable.pipe(meter));
    if (receivedBytes !== expectedBytes)
      throw new Error("UPLOAD_SIZE_MISMATCH");

    await prisma.csvUpload.update({
      where: { id: uploadId },
      data: {
        status: CsvUploadStatus.PROCESSING,
        checksum: hash.digest("hex"),
      },
    });
    const analysis = await analyzeCsv(uploadId);
    const datasetName = upload.originalName.replace(/\.csv$/i, "");
    const dataset = await prisma.dataset.create({
      data: {
        organizationId: upload.organizationId,
        createdById: session.user.id,
        name: datasetName,
        sourceType: DatasetSourceType.CSV_UPLOAD,
        status: DatasetStatus.PROCESSING,
        rowCount: BigInt(analysis.rowCount),
        sizeBytes: upload.sizeBytes,
        schema: analysis.columns,
        metadata: { preview: analysis.preview, uploadId },
      },
    });
    createdDatasetId = dataset.id;
    const storedRows = await storeCsvRows(
      dataset.id,
      uploadId,
      analysis.columns,
    );
    if (storedRows !== analysis.rowCount)
      throw new Error("DATASET_ROW_COUNT_MISMATCH");
    await prisma.$transaction(async (transaction) => {
      await transaction.dataset.update({
        where: { id: dataset.id },
        data: { status: DatasetStatus.READY, lastRefreshedAt: new Date() },
      });
      await transaction.csvUpload.update({
        where: { id: uploadId },
        data: {
          datasetId: dataset.id,
          status: CsvUploadStatus.COMPLETED,
          rowCount: BigInt(analysis.rowCount),
          completedAt: new Date(),
          errorDetails: Prisma.JsonNull,
        },
      });
    });
    await safeRecordAudit({
      organizationId: upload.organizationId,
      userId: session.user.id,
      action: "CREATE",
      entityType: "Dataset",
      entityId: dataset.id,
      description: "Dataset created from CSV upload",
      changes: {
        uploadId,
        name: dataset.name,
        rowCount: analysis.rowCount,
        sizeBytes: Number(upload.sizeBytes),
      },
      ...requestAuditMetadata(request),
    });
    return NextResponse.json({
      dataset: {
        id: dataset.id,
        name: dataset.name,
        rowCount: analysis.rowCount,
        columns: analysis.columns,
        preview: analysis.preview,
      },
    });
  } catch (error) {
    const message = csvErrorMessage(error);
    if (createdDatasetId) {
      await prisma.dataset
        .delete({ where: { id: createdDatasetId } })
        .catch(() => undefined);
    }
    if (uploadId) {
      await prisma.csvUpload
        .update({
          where: { id: uploadId },
          data: { status: CsvUploadStatus.FAILED, errorDetails: { message } },
        })
        .catch(() => undefined);
    }
    const status =
      message === "Unauthenticated."
        ? 401
        : message === "Forbidden."
          ? 403
          : message.includes("2 GB")
            ? 413
            : 422;
    return NextResponse.json({ error: message }, { status });
  }
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}

function csvErrorMessage(error: unknown) {
  const errorCode =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : undefined;
  const message =
    errorCode ??
    (error instanceof Error ? error.message : "CSV processing failed.");
  if (message.startsWith("CSV_COLUMN_TYPE_MISMATCH:")) {
    const [, column, row] = message.split(":");
    return `Column “${column}” contains an incompatible value at CSV row ${row}.`;
  }
  const messages: Record<string, string> = {
    UNAUTHENTICATED: "Unauthenticated.",
    FORBIDDEN: "Forbidden.",
    INVALID_ORIGIN: "Forbidden.",
    UPLOAD_SIZE_MISMATCH:
      "The uploaded byte count does not match the selected file.",
    CSV_COLUMN_LIMIT: "CSV files may contain at most 500 columns.",
    CSV_EMPTY_HEADER: "Every CSV column must have a header.",
    CSV_DUPLICATE_HEADER: "CSV column headers must be unique.",
    CSV_EMPTY_FILE: "The CSV file is empty.",
    CSV_NO_DATA_ROWS: "The CSV file contains headers but no data rows.",
    CSV_BINARY_CONTENT:
      "The selected file contains binary data and is not a valid text CSV.",
    CSV_RECORD_INCONSISTENT_FIELDS_LENGTH:
      "One or more rows contain a different number of columns than the header.",
    CSV_INVALID_CLOSING_QUOTE: "The CSV contains an invalid closing quote.",
    CSV_QUOTE_NOT_CLOSED: "The CSV contains an unclosed quoted value.",
    CSV_MAX_RECORD_SIZE: "A CSV row exceeds the supported 10 MB row limit.",
    DATASET_ROW_COUNT_MISMATCH:
      "The stored row count does not match the validated CSV row count.",
  };
  return messages[message] ?? message;
}

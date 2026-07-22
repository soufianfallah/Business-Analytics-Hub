import "server-only";

import { Prisma } from "@prisma/client";
import { parse } from "csv-parse";

import { inferValueType } from "@/features/datasets/application/infer-column-type";
import type { InferredColumn } from "@/features/datasets/domain/column-types";
import { createCsvReadStream } from "@/features/datasets/infrastructure/csv-storage";
import { prisma } from "@/lib/db/prisma";

const INSERT_BATCH_SIZE = 1_000;

export async function storeCsvRows(
  datasetId: string,
  uploadId: string,
  columns: InferredColumn[],
) {
  const parser = createCsvReadStream(uploadId).pipe(
    parse({
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false,
      max_record_size: 10 * 1024 * 1024,
    }),
  );
  let headers: string[] | undefined;
  let rowNumber = 0;
  let batch: Prisma.DatasetRowCreateManyInput[] = [];

  for await (const rawRecord of parser) {
    const record = rawRecord as string[];
    if (!headers) {
      headers = record.map((header) => header.trim());
      continue;
    }
    rowNumber += 1;
    record.forEach((value, index) => {
      const actual = inferValueType(value);
      const expected = columns[index]?.type ?? "string";
      const compatible =
        actual === "null" ||
        expected === "string" ||
        actual === expected ||
        (expected === "number" && actual === "integer") ||
        (expected === "datetime" && actual === "date");
      if (!compatible)
        throw new Error(
          `CSV_COLUMN_TYPE_MISMATCH:${columns[index]?.name ?? index + 1}:${rowNumber}`,
        );
    });
    const data = Object.fromEntries(
      headers.map((header, index) => [header, record[index]?.trim() || null]),
    ) as Prisma.InputJsonObject;
    batch.push({ datasetId, rowNumber: BigInt(rowNumber), data });
    if (batch.length === INSERT_BATCH_SIZE) {
      await prisma.datasetRow.createMany({ data: batch });
      batch = [];
    }
  }
  if (batch.length) await prisma.datasetRow.createMany({ data: batch });
  return rowNumber;
}

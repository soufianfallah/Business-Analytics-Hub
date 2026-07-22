import "server-only";

import { parse } from "csv-parse";

import {
  inferValueType,
  mergeColumnTypes,
} from "@/features/datasets/application/infer-column-type";
import type {
  ColumnType,
  CsvAnalysis,
} from "@/features/datasets/domain/column-types";
import { createCsvReadStream } from "@/features/datasets/infrastructure/csv-storage";

const PREVIEW_ROWS = 20;
const INFERENCE_ROWS = 1_000;
const MAX_COLUMNS = 500;

export async function analyzeCsv(uploadId: string): Promise<CsvAnalysis> {
  const parser = createCsvReadStream(uploadId).pipe(
    parse({
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false,
      max_record_size: 10 * 1024 * 1024,
    }),
  );
  let headers: string[] | undefined;
  let rowCount = 0;
  const inferred: Array<ColumnType | undefined> = [];
  const nullable: boolean[] = [];
  const preview: Record<string, string | null>[] = [];

  for await (const rawRecord of parser) {
    const record = rawRecord as string[];
    if (!headers) {
      headers = record.map((header) => header.trim());
      if (!headers.length || headers.length > MAX_COLUMNS)
        throw new Error("CSV_COLUMN_LIMIT");
      if (headers.some((header) => !header))
        throw new Error("CSV_EMPTY_HEADER");
      if (new Set(headers).size !== headers.length)
        throw new Error("CSV_DUPLICATE_HEADER");
      continue;
    }

    rowCount += 1;
    if (rowCount <= INFERENCE_ROWS) {
      record.forEach((value, index) => {
        const type = inferValueType(value);
        nullable[index] = Boolean(nullable[index] || type === "null");
        inferred[index] = mergeColumnTypes(inferred[index], type);
      });
    }
    if (preview.length < PREVIEW_ROWS) {
      preview.push(
        Object.fromEntries(
          headers.map((header, index) => [
            header,
            record[index]?.trim() || null,
          ]),
        ),
      );
    }
  }

  if (!headers) throw new Error("CSV_EMPTY_FILE");
  if (rowCount === 0) throw new Error("CSV_NO_DATA_ROWS");
  return {
    columns: headers.map((name, index) => ({
      name,
      type: inferred[index] ?? "string",
      nullable: nullable[index] ?? true,
    })),
    preview,
    rowCount,
  };
}

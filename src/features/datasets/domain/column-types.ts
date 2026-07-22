export const COLUMN_TYPES = [
  "integer",
  "number",
  "boolean",
  "date",
  "datetime",
  "string",
] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export type InferredColumn = {
  name: string;
  type: ColumnType;
  nullable: boolean;
};

export type CsvAnalysis = {
  columns: InferredColumn[];
  preview: Record<string, string | null>[];
  rowCount: number;
};

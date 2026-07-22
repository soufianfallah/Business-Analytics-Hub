import type { ColumnType } from "@/features/datasets/domain/column-types";

const INTEGER_PATTERN = /^[-+]?\d+$/;
const NUMBER_PATTERN = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no", "1", "0"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

export function inferValueType(value: string): ColumnType | "null" {
  const normalized = value.trim();
  if (!normalized) return "null";
  if (INTEGER_PATTERN.test(normalized)) return "integer";
  if (NUMBER_PATTERN.test(normalized)) return "number";
  if (BOOLEAN_VALUES.has(normalized.toLowerCase())) return "boolean";
  if (DATE_PATTERN.test(normalized) && !Number.isNaN(Date.parse(normalized)))
    return "date";
  if (
    DATETIME_PATTERN.test(normalized) &&
    !Number.isNaN(Date.parse(normalized))
  )
    return "datetime";
  return "string";
}

export function mergeColumnTypes(
  current: ColumnType | undefined,
  next: ColumnType | "null",
): ColumnType | undefined {
  if (next === "null") return current;
  if (!current || current === next) return next;
  if (
    (current === "integer" && next === "number") ||
    (current === "number" && next === "integer")
  )
    return "number";
  if (
    (current === "date" && next === "datetime") ||
    (current === "datetime" && next === "date")
  )
    return "datetime";
  return "string";
}

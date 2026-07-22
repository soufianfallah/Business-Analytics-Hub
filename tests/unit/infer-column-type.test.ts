import { describe, expect, it } from "vitest";
import {
  inferValueType,
  mergeColumnTypes,
} from "@/features/datasets/application/infer-column-type";

describe("inferValueType", () => {
  it.each([
    ["", "null"],
    ["  ", "null"],
    ["42", "integer"],
    ["-7", "integer"],
    ["+9", "integer"],
    ["3.14", "number"],
    [".5", "number"],
    ["1e3", "number"],
    ["TRUE", "boolean"],
    ["no", "boolean"],
    ["2026-07-22", "date"],
    ["2026-07-22T12:30:00Z", "datetime"],
    ["not-a-value", "string"],
    ["2026-99-99", "string"],
  ])("infers %s as %s", (value, expected) =>
    expect(inferValueType(value)).toBe(expected),
  );
});

describe("mergeColumnTypes", () => {
  it("ignores null values", () =>
    expect(mergeColumnTypes("integer", "null")).toBe("integer"));
  it("uses the first concrete type", () =>
    expect(mergeColumnTypes(undefined, "boolean")).toBe("boolean"));
  it("keeps identical types", () =>
    expect(mergeColumnTypes("date", "date")).toBe("date"));
  it.each([
    ["integer", "number", "number"],
    ["number", "integer", "number"],
    ["date", "datetime", "datetime"],
    ["datetime", "date", "datetime"],
    ["boolean", "integer", "string"],
  ] as const)("merges %s and %s", (current, next, expected) =>
    expect(mergeColumnTypes(current, next)).toBe(expected),
  );
});

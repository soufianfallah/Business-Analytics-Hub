import { AuditAction } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../mocks/prisma";

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  recordAudit,
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";

const event = {
  action: AuditAction.CREATE,
  entityType: "dataset",
  description: "created",
} as const;

describe("audit service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redacts secrets, bounds fields, and sanitizes nested JSON", async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
    const deep = { a: { b: { c: { d: { e: { f: { g: "hidden" } } } } } } };
    await recordAudit({
      ...event,
      organizationId: null,
      userId: null,
      entityType: "e".repeat(101),
      entityId: "i".repeat(300),
      description: "d".repeat(1100),
      ipAddress: "1".repeat(70),
      userAgent: "u".repeat(510),
      changes: {
        password: "visible-no-more",
        nested: { api_key: "secret", ok: true, count: 2, empty: null },
        long: "x".repeat(2001),
        list: Array.from({ length: 101 }, (_, index) => index),
        deep,
        fallback: Symbol("value"),
      },
    });
    const data = prismaMock.auditLog.create.mock.calls[0]![0].data;
    expect(data.entityType).toHaveLength(100);
    expect(data.entityId).toHaveLength(255);
    expect(data.description).toHaveLength(1000);
    expect(data.ipAddress).toHaveLength(64);
    expect(data.userAgent).toHaveLength(500);
    expect(data.changes.password).toBe("[REDACTED]");
    expect(data.changes.nested.api_key).toBe("[REDACTED]");
    expect(data.changes.long.length).toBe(2001);
    expect(data.changes.list).toHaveLength(100);
    expect(JSON.stringify(data.changes.deep)).toContain("[TRUNCATED]");
    expect(data.changes.fallback).toBe("Symbol(value)");
  });

  it("leaves changes undefined and defaults metadata", async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-2" });
    await recordAudit(event);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ changes: undefined, metadata: {} }),
    });
  });

  it("extracts request metadata with forwarded-IP precedence", () => {
    const result = requestAuditMetadata(
      new Request("https://example.test", {
        headers: {
          "x-forwarded-for": " 203.0.113.1, 10.0.0.1",
          "x-real-ip": "198.51.100.1",
          "user-agent": "Vitest",
          "x-request-id": "request-1",
        },
      }),
    );
    expect(result).toEqual({
      ipAddress: "203.0.113.1",
      userAgent: "Vitest",
      metadata: { requestId: "request-1" },
    });
  });

  it("falls back to real IP and generates a request id", () => {
    const result = requestAuditMetadata(
      new Request("https://example.test", {
        headers: { "x-real-ip": "198.51.100.1" },
      }),
    );
    expect(result.ipAddress).toBe("198.51.100.1");
    expect(result.metadata.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([new Error("database unavailable"), "unknown failure"])(
    "does not fail completed work when audit writing fails",
    async (failure) => {
      prismaMock.auditLog.create.mockRejectedValue(failure);
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      await expect(safeRecordAudit(event)).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        "[audit] write failed",
        expect.objectContaining({
          message: failure instanceof Error ? failure.message : "Unknown",
        }),
      );
    },
  );
});

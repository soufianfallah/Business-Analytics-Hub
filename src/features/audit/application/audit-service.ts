import "server-only";

import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const sensitive =
  /password|secret|token|authorization|cookie|api[-_]?key|stripe[-_]?signature|accessToken|refreshToken/i;
export type AuditEvent = {
  organizationId?: string | null;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  description: string;
  changes?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Append-only recorder. Callers cannot update or delete audit records. */
export async function recordAudit(event: AuditEvent) {
  return prisma.auditLog.create({
    data: {
      organizationId: event.organizationId,
      userId: event.userId,
      action: event.action,
      entityType: event.entityType.slice(0, 100),
      entityId: event.entityId?.slice(0, 255),
      description: event.description.slice(0, 1_000),
      changes:
        event.changes === undefined
          ? undefined
          : (sanitize(event.changes) as Prisma.InputJsonValue),
      metadata: sanitize(event.metadata ?? {}) as Prisma.InputJsonValue,
      ipAddress: event.ipAddress?.slice(0, 64),
      userAgent: event.userAgent?.slice(0, 500),
    },
  });
}

/** Audit failures are logged but never roll back the completed business action. */
export async function safeRecordAudit(event: AuditEvent) {
  try {
    await recordAudit(event);
  } catch (error) {
    console.error("[audit] write failed", {
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      message: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export function requestAuditMetadata(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return {
    ipAddress: forwarded ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
    },
  };
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (value == null || typeof value === "number" || typeof value === "boolean")
    return value;
  if (typeof value === "string")
    return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          sensitive.test(key) ? "[REDACTED]" : sanitize(item, depth + 1),
        ]),
    );
  return String(value);
}

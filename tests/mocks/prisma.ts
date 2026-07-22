import { vi } from "vitest";

export const prismaMock = {
  subscription: { findUnique: vi.fn() },
  organizationMember: { count: vi.fn() },
  dataset: { count: vi.fn(), aggregate: vi.fn() },
  dashboard: { count: vi.fn() },
  reportRun: { count: vi.fn() },
  aiMessage: { count: vi.fn() },
  auditLog: { create: vi.fn() },
};

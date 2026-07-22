import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../mocks/prisma";

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  assertWithinUsageLimit,
  getOrganizationUsage,
  UsageLimitError,
} from "@/features/billing/application/usage-limits";

function mockUsage(subscription: unknown = null, members = 1) {
  prismaMock.subscription.findUnique.mockResolvedValue(subscription);
  prismaMock.organizationMember.count.mockResolvedValue(members);
  prismaMock.dataset.count.mockResolvedValue(2);
  prismaMock.dashboard.count.mockResolvedValue(1);
  prismaMock.reportRun.count.mockResolvedValue(3);
  prismaMock.aiMessage.count.mockResolvedValue(4);
  prismaMock.dataset.aggregate.mockResolvedValue({
    _sum: { sizeBytes: BigInt(1024) },
  });
}

describe("organization usage limits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the free plan when no active subscription exists", async () => {
    mockUsage();
    const result = await getOrganizationUsage("org-1");
    expect(result.planKey).toBe("free");
    expect(result.usage).toMatchObject({
      members: 1,
      datasets: 2,
      storageBytes: 1024,
    });
    expect(prismaMock.reportRun.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ report: { organizationId: "org-1" } }),
      }),
    );
  });

  it.each(["TRIALING", "ACTIVE", "PAST_DUE"])(
    "honors a pro %s subscription",
    async (status) => {
      mockUsage({ planKey: "pro", status });
      expect((await getOrganizationUsage("org-1")).planKey).toBe("pro");
    },
  );

  it("rejects unknown and inactive plans", async () => {
    mockUsage({ planKey: "unknown", status: "ACTIVE" });
    expect((await getOrganizationUsage("org-1")).planKey).toBe("free");
    mockUsage({ planKey: "pro", status: "CANCELED" });
    expect((await getOrganizationUsage("org-1")).planKey).toBe("free");
  });

  it("handles empty storage and permits usage below the limit", async () => {
    mockUsage();
    prismaMock.dataset.aggregate.mockResolvedValue({
      _sum: { sizeBytes: null },
    });
    await expect(
      assertWithinUsageLimit("org-1", "datasets"),
    ).resolves.toBeUndefined();
  });

  it("throws a typed error when a finite limit is exceeded", async () => {
    mockUsage(null, 3);
    await expect(assertWithinUsageLimit("org-1", "members")).rejects.toEqual(
      expect.objectContaining({
        name: "UsageLimitError",
        resource: "members",
        used: 3,
      }),
    );
    expect(new UsageLimitError("members", 3, 3).message).toContain("3/3");
  });
});

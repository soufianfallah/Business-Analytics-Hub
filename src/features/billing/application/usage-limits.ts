import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  isPlanKey,
  plans,
  type LimitedResource,
  type PlanKey,
} from "@/features/billing/domain/plans";

export class UsageLimitError extends Error {
  constructor(
    readonly resource: LimitedResource,
    readonly used: number,
    readonly limit: number,
  ) {
    super(
      `Your plan limit for ${resource} has been reached (${used}/${limit}).`,
    );
    this.name = "UsageLimitError";
  }
}

export async function getOrganizationUsage(organizationId: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [
    subscription,
    members,
    datasets,
    dashboards,
    monthlyReports,
    monthlyAI,
    storage,
  ] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId } }),
    prisma.organizationMember.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    prisma.dataset.count({ where: { organizationId, deletedAt: null } }),
    prisma.dashboard.count({ where: { organizationId, deletedAt: null } }),
    prisma.reportRun.count({
      where: { report: { organizationId }, createdAt: { gte: monthStart } },
    }),
    prisma.aiMessage.count({
      where: {
        conversation: { organizationId },
        role: "ASSISTANT",
        createdAt: { gte: monthStart },
      },
    }),
    prisma.dataset.aggregate({
      where: { organizationId, deletedAt: null },
      _sum: { sizeBytes: true },
    }),
  ]);
  const planKey: PlanKey =
    subscription &&
    isPlanKey(subscription.planKey) &&
    ["TRIALING", "ACTIVE", "PAST_DUE"].includes(subscription.status)
      ? subscription.planKey
      : "free";
  return {
    planKey,
    subscription,
    usage: {
      members,
      datasets,
      dashboards,
      monthlyReports,
      monthlyAI,
      storageBytes: Number(storage._sum.sizeBytes ?? BigInt(0)),
    },
    limits: plans[planKey].limits,
  };
}

export async function assertWithinUsageLimit(
  organizationId: string,
  resource: LimitedResource,
  increment = 1,
) {
  const { usage, limits } = await getOrganizationUsage(organizationId);
  const used = usage[resource];
  const limit = limits[resource];
  if (Number.isFinite(limit) && used + increment > limit)
    throw new UsageLimitError(resource, used, limit);
}

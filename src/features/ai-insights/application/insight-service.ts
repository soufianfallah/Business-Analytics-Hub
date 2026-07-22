import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import type { BusinessStatistics } from "@/features/ai-insights/application/calculate-statistics";
import type { AIService } from "@/features/ai-insights/domain/ai-service";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";

const system = `You are a senior business analyst. Convert only the supplied calculated statistics into concise, professional business insights.
Never calculate new values, invent causes, add benchmarks, or claim causation. Mention missing comparisons honestly. Use 2-4 short paragraphs and plain text.`;

export async function getCachedInsight(
  organizationId: string,
  statistics: BusinessStatistics,
  ai: AIService,
) {
  const cacheKey = key(statistics, ai);
  const cached = await prisma.aIInsightCache.findUnique({
    where: { organizationId_cacheKey: { organizationId, cacheKey } },
  });
  return cached && cached.expiresAt > new Date()
    ? { cacheKey, response: cached.response }
    : { cacheKey, response: null };
}

export async function saveInsight(
  organizationId: string,
  cacheKey: string,
  statistics: BusinessStatistics,
  response: string,
  ai: AIService,
) {
  const ttl = getServerEnv().AI_CACHE_TTL_SECONDS;
  if (ttl <= 0 || !response.trim()) return;
  await prisma.aIInsightCache.upsert({
    where: { organizationId_cacheKey: { organizationId, cacheKey } },
    create: {
      organizationId,
      cacheKey,
      provider: ai.provider,
      model: ai.model,
      statistics: statistics as unknown as Prisma.InputJsonValue,
      response,
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
    update: {
      statistics: statistics as unknown as Prisma.InputJsonValue,
      response,
      provider: ai.provider,
      model: ai.model,
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
  });
  void prisma.aIInsightCache
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
}

export function insightRequest(statistics: BusinessStatistics) {
  return {
    system,
    prompt: `Calculated statistics (authoritative JSON):\n${JSON.stringify(statistics, null, 2)}\n\nWrite the business insight now.`,
  };
}
function key(statistics: BusinessStatistics, ai: AIService) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        statistics,
        provider: ai.provider,
        model: ai.model,
        promptVersion: 1,
      }),
    )
    .digest("hex");
}

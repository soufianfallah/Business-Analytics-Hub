import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import {
  assertWithinUsageLimit,
  UsageLimitError,
} from "@/features/billing/application/usage-limits";
import { calculateStatistics } from "@/features/ai-insights/application/calculate-statistics";
import {
  getCachedInsight,
  insightRequest,
  saveInsight,
} from "@/features/ai-insights/application/insight-service";
import { createAIService } from "@/features/ai-insights/server";
import { insightRequestSchema } from "@/features/ai-insights/schemas/insight-schema";
import type { InferredColumn } from "@/features/datasets/domain/column-types";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.nextUrl.host)
      throw new Error("INVALID_ORIGIN");
    const input = insightRequestSchema.parse(await request.json());
    const session = await requireOrganizationPermission(input.organizationId, {
      dataset: ["read"],
    });
    await assertWithinUsageLimit(input.organizationId, "monthlyAI");
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: input.datasetId,
        organizationId: input.organizationId,
        deletedAt: null,
        status: "READY",
      },
      select: { id: true, schema: true },
    });
    if (!dataset)
      return NextResponse.json(
        { error: "Dataset not found." },
        { status: 404 },
      );
    const statistics = await calculateStatistics(
      dataset.id,
      dataset.schema as unknown as InferredColumn[],
      input.mapping,
    );
    const ai = createAIService();
    const cached = await getCachedInsight(input.organizationId, statistics, ai);
    console.info("[ai.insights] request", {
      organizationId: input.organizationId,
      datasetId: input.datasetId,
      provider: ai.provider,
      model: ai.model,
      cached: Boolean(cached.response),
    });
    if (cached.response) {
      await safeRecordAudit({
        organizationId: input.organizationId,
        userId: session.user.id,
        action: "AI_USAGE",
        entityType: "AIInsight",
        entityId: cached.cacheKey,
        description: "Cached AI dataset insight served",
        changes: {
          datasetId: input.datasetId,
          provider: ai.provider,
          model: ai.model,
          cached: true,
        },
        ...requestAuditMetadata(request),
      });
      return new Response(cached.response, { headers: streamHeaders("HIT") });
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let output = "";
        try {
          for await (const token of ai.stream({
            ...insightRequest(statistics),
            signal: request.signal,
          })) {
            output += token;
            controller.enqueue(encoder.encode(token));
          }
          await saveInsight(
            input.organizationId,
            cached.cacheKey,
            statistics,
            output,
            ai,
          );
          await safeRecordAudit({
            organizationId: input.organizationId,
            userId: session.user.id,
            action: "AI_USAGE",
            entityType: "AIInsight",
            entityId: cached.cacheKey,
            description: "AI dataset insight generated",
            changes: {
              datasetId: input.datasetId,
              provider: ai.provider,
              model: ai.model,
              cached: false,
              responseCharacters: output.length,
            },
            ...requestAuditMetadata(request),
          });
          controller.close();
        } catch (error) {
          console.error("[ai.insights] stream failed", {
            provider: ai.provider,
            model: ai.model,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          controller.error(error);
        }
      },
    });
    return new Response(stream, { headers: streamHeaders("MISS") });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate insights.";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
          ? 403
          : error instanceof UsageLimitError
            ? 402
            : error instanceof z.ZodError
              ? 400
              : 500;
    console.error("[ai.insights] request failed", { status, message });
    return NextResponse.json(
      { error: status === 500 ? message : message },
      { status },
    );
  }
}
function streamHeaders(cache: string) {
  return {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-ai-cache": cache,
    "x-content-type-options": "nosniff",
  };
}

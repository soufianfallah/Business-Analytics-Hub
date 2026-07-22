import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { cacheHealth } from "@/lib/cache/cache";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const cache = await cacheHealth();
    return NextResponse.json({
      status: "ready",
      checks: { database: "ok", cache },
      latencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("readiness_check_failed", error);
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { database: "failed" },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

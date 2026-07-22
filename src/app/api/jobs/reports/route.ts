import { ReportTrigger } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { generateReport } from "@/features/reports/application/generate-report";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const due = await prisma.reportSchedule.findMany({
    where: { isActive: true, nextRunAt: { lte: new Date() } },
    include: { report: { select: { id: true, format: true } } },
    take: 25,
  });
  const results = [];
  for (const schedule of due) {
    try {
      const runId = await generateReport(
        schedule.report.id,
        schedule.report.format,
        schedule.recipients as string[],
        ReportTrigger.SCHEDULED,
      );
      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: advance(schedule.nextRunAt, schedule.cron),
        },
      });
      results.push({ scheduleId: schedule.id, runId });
    } catch {
      results.push({ scheduleId: schedule.id, failed: true });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}
function advance(from: Date, cron: string) {
  const next = new Date(Math.max(from.getTime(), Date.now()));
  if (cron === "0 8 * * *") next.setUTCDate(next.getUTCDate() + 1);
  else if (cron === "0 8 * * 1") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1, 1);
  return next;
}

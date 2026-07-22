import { FileBarChart } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportManager } from "@/features/reports/components/report-manager";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ReportsPage() {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId)
    return (
      <EmptyState
        title="Choose an organization"
        description="Reports belong to an organization."
        action={
          <Button asChild>
            <Link href="/dashboard/organizations">Manage organizations</Link>
          </Button>
        }
      />
    );
  await requireOrganizationPermission(organizationId, { report: ["read"] });
  const [datasets, reports] = await Promise.all([
    prisma.dataset.findMany({
      where: { organizationId, deletedAt: null, status: "READY" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.report.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        schedule: true,
        runs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
  ]);
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Workspace</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileBarChart className="size-6" />
          Reports
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate, schedule, deliver, and audit organization reports.
        </p>
      </div>
      {!datasets.length ? (
        <EmptyState
          title="No ready datasets"
          description="Upload and process a dataset before creating a report."
          action={
            <Button asChild>
              <Link href="/dashboard/datasets/upload">Upload CSV</Link>
            </Button>
          }
        />
      ) : (
        <ReportManager
          organizationId={organizationId}
          datasets={datasets}
          reports={reports.map((report) => ({
            id: report.id,
            name: report.name,
            description: report.description,
            format: report.format,
            schedule: report.schedule
              ? {
                  cron: report.schedule.cron,
                  nextRunAt: report.schedule.nextRunAt.toISOString(),
                }
              : null,
            runs: report.runs.map((run) => ({
              id: run.id,
              status: run.status,
              format: run.format,
              createdAt: run.createdAt.toISOString(),
            })),
          }))}
        />
      )}
    </section>
  );
}

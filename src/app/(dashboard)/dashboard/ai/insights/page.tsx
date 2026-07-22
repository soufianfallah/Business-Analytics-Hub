import { BrainCircuit } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InsightsGenerator } from "@/features/ai-insights/components/insights-generator";
import type { InferredColumn } from "@/features/datasets/domain/column-types";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AIInsightsPage() {
  const session = await requireSession(); const organizationId = session.session.activeOrganizationId;
  if (!organizationId) return <EmptyState title="Choose an organization" description="AI insights are scoped to an organization." action={<Button asChild><Link href="/dashboard/organizations">Manage organizations</Link></Button>} />;
  await requireOrganizationPermission(organizationId, { dataset: ["read"] });
  const datasets = await prisma.dataset.findMany({ where: { organizationId, deletedAt: null, status: "READY" }, orderBy: { name: "asc" }, select: { id: true, name: true, schema: true } });
  return <section className="space-y-6"><div><p className="text-sm text-muted-foreground">Local intelligence</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight"><BrainCircuit className="size-6" />AI Insights</h1><p className="mt-2 text-sm text-muted-foreground">Generate a fixed statistical briefing using your local Ollama model.</p></div>{datasets.length ? <InsightsGenerator organizationId={organizationId} datasets={datasets.map((dataset) => ({ id: dataset.id, name: dataset.name, columns: ((dataset.schema ?? []) as unknown as InferredColumn[]).map((column) => column.name) }))} /> : <EmptyState title="No ready datasets" description="Upload and process real data before generating insights." action={<Button asChild><Link href="/dashboard/datasets/upload">Upload CSV</Link></Button>} />}</section>;
}

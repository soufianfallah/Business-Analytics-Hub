import { Suspense } from "react";
import { Database, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DatasetInfiniteGrid } from "@/features/datasets/components/dataset-infinite-grid";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function DatasetsPage() { const session = await requireSession(); const organizationId = session.session.activeOrganizationId; return <div className="space-y-6"><div className="flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Datasets</h1><p className="mt-2 text-sm text-muted-foreground">Manage the data sources used by dashboards and reports.</p></div><Button asChild><Link href="/dashboard/datasets/upload"><Upload className="size-4" />Upload CSV</Link></Button></div>{!organizationId ? <EmptyState icon={Database} title="No active organization" description="Select an organization before managing datasets." /> : <Suspense fallback={<DatasetGridSkeleton />}><DatasetResults organizationId={organizationId} /></Suspense>}</div>; }
async function DatasetResults({ organizationId }: { organizationId: string }) { await requireOrganizationPermission(organizationId, { dataset: ["read"] }); const rows = await prisma.dataset.findMany({ where: { organizationId, deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25, select: { id: true, name: true, status: true, rowCount: true, sizeBytes: true, createdAt: true } }); if (!rows.length) return <EmptyState icon={Database} title="Your datasets will appear here" description="Upload a CSV file to create the first dataset in your active organization." action={<Button asChild variant="outline"><Link href="/dashboard/datasets/upload">Import CSV</Link></Button>} />; const hasMore = rows.length > 24; const items = rows.slice(0, 24); return <DatasetInfiniteGrid initialItems={items.map((item) => ({ ...item, rowCount: item.rowCount?.toString() ?? null, sizeBytes: item.sizeBytes?.toString() ?? null, createdAt: item.createdAt.toISOString() }))} initialCursor={hasMore ? items.at(-1)?.id ?? null : null} />; }
function DatasetGridSkeleton() { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-44 rounded-xl" key={index} />)}</div>; }

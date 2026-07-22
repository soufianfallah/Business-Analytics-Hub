import { AuditAction, Prisma } from "@prisma/client";
import { Search, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const PAGE_SIZE = 50;
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;
  const params = await searchParams;
  if (!organizationId)
    return (
      <EmptyState
        title="Choose an organization"
        description="Audit logs are scoped to an organization."
        action={
          <Button asChild>
            <Link href="/dashboard/organizations">Manage organizations</Link>
          </Button>
        }
      />
    );
  await requireOrganizationPermission(organizationId, { audit: ["read"] });
  const query = text(params.q).slice(0, 200);
  const actionValue = text(params.action);
  const entityType = text(params.entity).slice(0, 100);
  const actor = text(params.actor).slice(0, 200);
  const from = validDate(text(params.from));
  const to = validDate(text(params.to), true);
  const page = Math.max(1, Number.parseInt(text(params.page) || "1", 10) || 1);
  const where: Prisma.AuditLogWhereInput = {
    organizationId,
    ...(actionValue &&
    Object.values(AuditAction).includes(actionValue as AuditAction)
      ? { action: actionValue as AuditAction }
      : {}),
    ...(entityType ? { entityType } : {}),
    ...(actor
      ? {
          user: {
            OR: [
              { name: { contains: actor, mode: "insensitive" } },
              { email: { contains: actor, mode: "insensitive" } },
            ],
          },
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { description: { contains: query, mode: "insensitive" } },
            { entityType: { contains: query, mode: "insensitive" } },
            { entityId: { contains: query, mode: "insensitive" } },
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [logs, total, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ["entityType"],
      where: { organizationId },
      orderBy: { entityType: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[0] !== "page",
      ),
    ),
  );
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Security and compliance</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="size-6" />
          Audit logs
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Append-only history of security, data, billing, export, and AI
          activity.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search and filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
            method="get"
          >
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                defaultValue={query}
                name="q"
                placeholder="Search events…"
              />
            </div>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              defaultValue={actionValue}
              name="action"
            >
              <option value="">All actions</option>
              {Object.values(AuditAction).map((action) => (
                <option key={action} value={action}>
                  {label(action)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              defaultValue={entityType}
              name="entity"
            >
              <option value="">All entities</option>
              {entities.map(({ entityType }) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
            <Input
              defaultValue={actor}
              name="actor"
              placeholder="Actor name or email"
            />
            <Button type="submit">Apply filters</Button>
            <Input defaultValue={text(params.from)} name="from" type="date" />
            <Input defaultValue={text(params.to)} name="to" type="date" />
            <Button asChild className="md:col-start-6" variant="ghost">
              <Link href="/dashboard/audit">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="pr-4">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap pl-4 text-xs text-muted-foreground">
                    {log.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{label(log.action)}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{log.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId}` : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    {log.user ? (
                      <>
                        <p>{log.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.user.email}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <p>{log.ipAddress ?? "—"}</p>
                    <p
                      className="max-w-40 truncate"
                      title={log.userAgent ?? undefined}
                    >
                      {log.userAgent ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="pr-4">
                    {log.changes || hasMetadata(log.metadata) ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium">
                          View
                        </summary>
                        <pre className="mt-2 max-h-48 max-w-80 overflow-auto rounded bg-muted p-2 text-[11px]">
                          {JSON.stringify(
                            { changes: log.changes, metadata: log.metadata },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!logs.length ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      compact
                      className="border-0"
                      title="No matching events"
                      description="Try changing or clearing the current filters."
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {total.toLocaleString()} event{total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild disabled={page <= 1} size="sm" variant="outline">
            <Link
              aria-disabled={page <= 1}
              href={`?${withPage(base, page - 1)}`}
            >
              Previous
            </Link>
          </Button>
          <span>
            Page {Math.min(page, pages)} of {pages}
          </span>
          <Button asChild disabled={page >= pages} size="sm" variant="outline">
            <Link
              aria-disabled={page >= pages}
              href={`?${withPage(base, page + 1)}`}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
const text = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";
function validDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
function withPage(base: URLSearchParams, page: number) {
  const copy = new URLSearchParams(base);
  copy.set("page", String(Math.max(1, page)));
  return copy.toString();
}
function hasMetadata(value: unknown) {
  return Boolean(
    value && typeof value === "object" && Object.keys(value).length,
  );
}

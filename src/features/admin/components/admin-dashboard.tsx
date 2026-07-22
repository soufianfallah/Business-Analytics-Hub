"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CreditCard,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const chartLoading = () => <Skeleton className="h-[420px] rounded-xl" />;
const AreaAnalyticsChart = dynamic(
  () => import("@/features/charts").then((module) => module.AreaAnalyticsChart),
  { ssr: false, loading: chartLoading },
);
const BarAnalyticsChart = dynamic(
  () => import("@/features/charts").then((module) => module.BarAnalyticsChart),
  { ssr: false, loading: chartLoading },
);
const PieAnalyticsChart = dynamic(
  () => import("@/features/charts").then((module) => module.PieAnalyticsChart),
  { ssr: false, loading: chartLoading },
);

type Props = {
  kpis: Array<{ label: string; value: string; detail: string }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    suspended: boolean;
    createdAt: string;
    organizations: number;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    members: number;
    datasets: number;
    createdAt: string;
  }>;
  subscriptions: Array<{
    id: string;
    organization: string;
    plan: string;
    status: string;
    amount: string;
    periodEnd: string | null;
  }>;
  reports: Array<{
    id: string;
    name: string;
    organization: string;
    status: string;
    format: string;
    generatedAt: string | null;
  }>;
  logs: Array<{
    id: string;
    action: string;
    description: string;
    entity: string;
    actor: string;
    organization: string;
    createdAt: string;
  }>;
  health: Array<{
    name: string;
    status: "healthy" | "warning";
    detail: string;
  }>;
  userGrowth: Array<{ date: string; users: number }>;
  aiGrowth: Array<{ date: string; messages: number }>;
  plans: Array<{ name: string; value: number }>;
  aiModels: Array<{ model: string; messages: number }>;
};
export function AdminDashboard(props: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = search.toLowerCase();
  const matches = useCallback(
    (...values: string[]) =>
      !q || values.some((value) => value.toLowerCase().includes(q)),
    [q],
  );
  async function mutate(url: string, body: object) {
    setBusy(url);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Admin action failed.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setBusy(null);
    }
  }
  const filteredUsers = useMemo(
    () =>
      props.users.filter(
        (user) =>
          !q ||
          [user.name, user.email, user.role].some((value) =>
            value.toLowerCase().includes(q),
          ),
      ),
    [props.users, q],
  );
  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {props.kpis.map((kpi, index) => {
          const Icon =
            [Users, Building2, CreditCard, Activity][index] ?? Activity;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {kpi.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{kpi.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {kpi.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
          placeholder="Search admin records…"
        />
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="ai">AI usage</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="health">System health</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
          <AreaAnalyticsChart
            title="User growth"
            data={props.userGrowth}
            categoryKey="date"
            series={[{ key: "users", label: "New users" }]}
          />
          <BarAnalyticsChart
            title="AI usage"
            data={props.aiGrowth}
            categoryKey="date"
            series={[{ key: "messages", label: "Responses" }]}
          />
          <PieAnalyticsChart
            title="Plan distribution"
            data={props.plans}
            categoryKey="name"
            series={[{ key: "value", label: "Organizations" }]}
          />
          <BarAnalyticsChart
            title="AI models"
            data={props.aiModels}
            categoryKey="model"
            series={[{ key: "messages", label: "Messages" }]}
          />
        </TabsContent>
        <TabsContent value="users">
          <AdminCard
            title="Users"
            description="Suspend accounts and manage platform administrator access."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organizations</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role}</Badge>
                    </TableCell>
                    <TableCell>{user.organizations}</TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() =>
                          mutate(`/api/admin/users/${user.id}`, {
                            action: user.suspended ? "restore" : "suspend",
                          })
                        }
                      >
                        {busy?.includes(user.id) ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        {user.suspended ? "Restore" : "Suspend"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() =>
                          mutate(`/api/admin/users/${user.id}`, {
                            action:
                              user.role === "ADMIN" ? "demote" : "promote",
                          })
                        }
                      >
                        {user.role === "ADMIN" ? "Demote" : "Make admin"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminCard>
        </TabsContent>
        <TabsContent value="organizations">
          <AdminCard
            title="Organizations"
            description="Suspend, restore, or archive workspaces."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Datasets</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.organizations
                  .filter((item) => matches(item.name, item.slug, item.status))
                  .map((organization) => (
                    <TableRow key={organization.id}>
                      <TableCell>
                        <p className="font-medium">{organization.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {organization.slug}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{organization.status}</Badge>
                      </TableCell>
                      <TableCell>{organization.members}</TableCell>
                      <TableCell>{organization.datasets}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            mutate(
                              `/api/admin/organizations/${organization.id}`,
                              {
                                status:
                                  organization.status === "ACTIVE"
                                    ? "SUSPENDED"
                                    : "ACTIVE",
                              },
                            )
                          }
                        >
                          {organization.status === "ACTIVE"
                            ? "Suspend"
                            : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            mutate(
                              `/api/admin/organizations/${organization.id}`,
                              { status: "ARCHIVED" },
                            )
                          }
                        >
                          Archive
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </AdminCard>
        </TabsContent>
        <TabsContent value="subscriptions">
          <SimpleTable
            title="Subscriptions"
            headers={["Organization", "Plan", "Status", "Amount", "Period end"]}
            rows={props.subscriptions
              .filter((item) =>
                matches(item.organization, item.plan, item.status),
              )
              .map((item) => [
                item.organization,
                item.plan,
                item.status,
                item.amount,
                item.periodEnd
                  ? new Date(item.periodEnd).toLocaleDateString()
                  : "—",
              ])}
          />
        </TabsContent>
        <TabsContent value="ai">
          <SimpleTable
            title="AI usage by model"
            headers={["Model", "Responses"]}
            rows={props.aiModels
              .filter((item) => matches(item.model))
              .map((item) => [item.model, item.messages.toLocaleString()])}
          />
        </TabsContent>
        <TabsContent value="reports">
          <SimpleTable
            title="Reports"
            headers={[
              "Report",
              "Organization",
              "Status",
              "Format",
              "Generated",
            ]}
            rows={props.reports
              .filter((item) =>
                matches(item.name, item.organization, item.status),
              )
              .map((item) => [
                item.name,
                item.organization,
                item.status,
                item.format,
                item.generatedAt
                  ? new Date(item.generatedAt).toLocaleString()
                  : "Never",
              ])}
          />
        </TabsContent>
        <TabsContent value="logs">
          <SimpleTable
            title="Platform audit logs"
            headers={[
              "Time",
              "Action",
              "Event",
              "Entity",
              "Actor",
              "Organization",
            ]}
            rows={props.logs
              .filter((item) =>
                matches(
                  item.description,
                  item.action,
                  item.actor,
                  item.organization,
                ),
              )
              .map((item) => [
                new Date(item.createdAt).toLocaleString(),
                item.action,
                item.description,
                item.entity,
                item.actor,
                item.organization,
              ])}
          />
        </TabsContent>
        <TabsContent value="health">
          <div className="grid gap-4 md:grid-cols-2">
            {props.health.map((item) => (
              <Card key={item.name}>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <CardDescription>{item.detail}</CardDescription>
                  </div>
                  <Badge
                    variant={item.status === "healthy" ? "default" : "outline"}
                  >
                    {item.status}
                  </Badge>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
function AdminCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
function SimpleTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <AdminCard
      title={title}
      description={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCard>
  );
}

import { Prisma } from "@prisma/client";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";
import { requirePlatformAdminPage } from "@/features/admin/server/authorization";
import { getServerEnv } from "@/lib/env";
import { cacheHealth } from "@/lib/cache/cache";
import { prisma } from "@/lib/db/prisma";

export default async function AdminPage() {
  await requirePlatformAdminPage();
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const dbStarted = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbLatency = Math.round(performance.now() - dbStarted);
  const [
    users,
    organizations,
    subscriptions,
    reports,
    logs,
    totalUsers,
    totalOrganizations,
    aiThisMonth,
    reportsThisMonth,
    userGrowthRaw,
    aiGrowthRaw,
    aiModelsRaw,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        deletedAt: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        _count: { select: { members: true, datasets: true } },
      },
    }),
    prisma.subscription.findMany({
      orderBy: { updatedAt: "desc" },
      take: 250,
      include: { organization: { select: { name: true } } },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      include: { organization: { select: { name: true } } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.user.count(),
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.aiMessage.count({
      where: { role: "ASSISTANT", createdAt: { gte: monthStart } },
    }),
    prisma.reportRun.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.$queryRaw<Array<{ date: Date; users: number }>>(
      Prisma.sql`SELECT DATE_TRUNC('day', "createdAt") date, COUNT(*)::int users FROM "User" WHERE "createdAt" >= ${thirtyDaysAgo} GROUP BY 1 ORDER BY 1`,
    ),
    prisma.$queryRaw<Array<{ date: Date; messages: number }>>(
      Prisma.sql`SELECT DATE_TRUNC('day', "createdAt") date, COUNT(*)::int messages FROM "AiMessage" WHERE role = 'ASSISTANT' AND "createdAt" >= ${thirtyDaysAgo} GROUP BY 1 ORDER BY 1`,
    ),
    prisma.aiMessage.groupBy({
      by: ["model"],
      where: { role: "ASSISTANT", createdAt: { gte: monthStart } },
      _count: { _all: true },
      orderBy: { _count: { model: "desc" } },
      take: 10,
    }),
  ]);
  const activeSubscriptions = subscriptions.filter((item) =>
    ["ACTIVE", "TRIALING", "PAST_DUE"].includes(item.status),
  );
  const mrr = activeSubscriptions.reduce(
    (sum, item) =>
      sum +
      (item.billingInterval === "YEARLY"
        ? item.unitAmount / 12
        : item.unitAmount),
    0,
  );
  const planCounts = new Map<string, number>();
  organizations.forEach((organization) => {
    const plan =
      activeSubscriptions.find(
        (subscription) => subscription.organizationId === organization.id,
      )?.planKey ?? "free";
    planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1);
  });
  const env = getServerEnv();
  const ollamaHealthy = await fetch(
    `${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/tags`,
    { signal: AbortSignal.timeout(1_500), cache: "no-store" },
  )
    .then((response) => response.ok)
    .catch(() => false);
  const cache = await cacheHealth();
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Platform operations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage platform accounts, organizations, billing, analytics workloads,
          and system status.
        </p>
      </div>
      <AdminDashboard
        kpis={[
          {
            label: "Total users",
            value: totalUsers.toLocaleString(),
            detail: `${users.filter((user) => user.createdAt >= monthStart).length} joined this month`,
          },
          {
            label: "Organizations",
            value: totalOrganizations.toLocaleString(),
            detail: `${organizations.filter((item) => item.status === "ACTIVE").length} active`,
          },
          {
            label: "Monthly recurring",
            value: new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(mrr / 100),
            detail: `${activeSubscriptions.length} paid or trialing`,
          },
          {
            label: "AI responses",
            value: aiThisMonth.toLocaleString(),
            detail: `${reportsThisMonth} report runs this month`,
          },
        ]}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.platformRole,
          suspended: Boolean(user.deletedAt),
          createdAt: user.createdAt.toISOString(),
          organizations: user._count.memberships,
        }))}
        organizations={organizations.map((organization) => ({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          members: organization._count.members,
          datasets: organization._count.datasets,
          createdAt: organization.createdAt.toISOString(),
        }))}
        subscriptions={subscriptions.map((subscription) => ({
          id: subscription.id,
          organization: subscription.organization.name,
          plan: subscription.planKey,
          status: subscription.status,
          amount: new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: subscription.currency,
          }).format(subscription.unitAmount / 100),
          periodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        }))}
        reports={reports.map((report) => ({
          id: report.id,
          name: report.name,
          organization: report.organization.name,
          status: report.status,
          format: report.format,
          generatedAt: report.generatedAt?.toISOString() ?? null,
        }))}
        logs={logs.map((log) => ({
          id: log.id,
          action: log.action,
          description: log.description ?? "Audit event",
          entity: log.entityType,
          actor: log.user?.name ?? log.user?.email ?? "System",
          organization: log.organization?.name ?? "Platform",
          createdAt: log.createdAt.toISOString(),
        }))}
        health={[
          {
            name: "PostgreSQL",
            status: dbLatency < 250 ? "healthy" : "warning",
            detail: `Connected · ${dbLatency} ms query latency`,
          },
          {
            name: "Stripe",
            status: env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
              ? "healthy"
              : "warning",
            detail: env.STRIPE_SECRET_KEY
              ? "Test mode configured"
              : "Safe design mode",
          },
          {
            name: "Ollama",
            status: ollamaHealthy ? "healthy" : "warning",
            detail: ollamaHealthy
              ? `${env.OLLAMA_BASE_URL} · reachable`
              : `${env.OLLAMA_BASE_URL} · unavailable`,
          },
          {
            name: "Application cache",
            status: "healthy",
            detail:
              cache.layer === "redis"
                ? "Redis connected"
                : "Bounded in-memory fallback",
          },
          { name: "Report storage", status: "healthy", detail: env.UPLOAD_DIR },
          {
            name: "Audit pipeline",
            status: "healthy",
            detail: `${logs.length} recent events loaded`,
          },
        ]}
        userGrowth={userGrowthRaw.map((item) => ({
          date: item.date.toISOString().slice(5, 10),
          users: item.users,
        }))}
        aiGrowth={aiGrowthRaw.map((item) => ({
          date: item.date.toISOString().slice(5, 10),
          messages: item.messages,
        }))}
        plans={[...planCounts].map(([name, value]) => ({ name, value }))}
        aiModels={aiModelsRaw.map((item) => ({
          model: item.model ?? "unknown",
          messages: item._count._all,
        }))}
      />
    </section>
  );
}

import { Bot, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyticsChat } from "@/features/ai-assistant/components/analytics-chat";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export default async function AIAssistantPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const session = await requireSession(); const organizationId = session.session.activeOrganizationId; const { conversation: requestedId } = await searchParams;
  if (!organizationId) return <EmptyState title="Choose an organization" description="AI conversations are scoped to an organization." action={<Button asChild><Link href="/dashboard/organizations">Manage organizations</Link></Button>} />;
  await requireOrganizationPermission(organizationId, { dataset: ["read"], dashboard: ["read"], report: ["read"] });
  const [datasets, conversations] = await Promise.all([
    prisma.dataset.findMany({ where: { organizationId, deletedAt: null, status: "READY" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.aiConversation.findMany({ where: { organizationId, userId: session.user.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } }),
  ]);
  const activeId = requestedId && conversations.some((item) => item.id === requestedId) ? requestedId : undefined;
  const messages = activeId ? await prisma.aiMessage.findMany({ where: { conversationId: activeId }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true, role: true, content: true, metadata: true } }) : [];
  return <section className="space-y-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Local intelligence</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight"><Bot className="size-6" />AI Analytics Assistant</h1><p className="mt-2 text-sm text-muted-foreground">Ask evidence-based questions using your organization’s authorized business data.</p></div><Button asChild variant="outline"><Link href="/dashboard/ai/insights"><Sparkles className="size-4" />Structured insights</Link></Button></div><div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]"><aside className="rounded-xl border bg-card p-3"><Button asChild className="w-full"><Link href="/dashboard/ai"><Plus className="size-4" />New conversation</Link></Button><nav aria-label="Conversation history" className="mt-3 space-y-1">{conversations.map((item) => <Link key={item.id} href={`/dashboard/ai?conversation=${item.id}`} className={cn("block truncate rounded-lg px-3 py-2 text-sm hover:bg-accent", activeId === item.id && "bg-accent font-medium")}>{item.title ?? "Untitled conversation"}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{item.updatedAt.toLocaleDateString()}</span></Link>)}</nav></aside><AnalyticsChat organizationId={organizationId} conversationId={activeId} datasets={datasets} initialMessages={messages.map((message) => ({ id: message.id, role: message.role === "USER" ? "USER" as const : "ASSISTANT" as const, content: message.content, suggestions: metadataSuggestions(message.metadata) }))} /></div></section>;
}
function metadataSuggestions(metadata: unknown) { if (!metadata || typeof metadata !== "object" || !("suggested" in metadata) || !Array.isArray(metadata.suggested)) return []; return metadata.suggested.filter((value): value is string => typeof value === "string").slice(0, 3); }

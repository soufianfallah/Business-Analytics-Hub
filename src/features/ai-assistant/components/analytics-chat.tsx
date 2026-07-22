"use client";

import { useRef, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Send,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  suggestions: string[];
};
type Dataset = { id: string; name: string };
export function AnalyticsChat({
  organizationId,
  conversationId: initialConversationId,
  initialMessages,
  datasets,
}: {
  organizationId: string;
  conversationId?: string;
  initialMessages: Message[];
  datasets: Dataset[];
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [datasetId, setDatasetId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  async function send(text: string, regenerateMessageId?: string) {
    if (!text.trim() && !regenerateMessageId) return;
    setLoading(true);
    setError(null);
    abort.current = new AbortController();
    const temporaryId = crypto.randomUUID();
    if (!regenerateMessageId)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "USER",
          content: text,
          suggestions: [],
        },
        { id: temporaryId, role: "ASSISTANT", content: "", suggestions: [] },
      ]);
    else
      setMessages((current) => [
        ...current,
        { id: temporaryId, role: "ASSISTANT", content: "", suggestions: [] },
      ]);
    setQuestion("");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          organizationId,
          conversationId,
          datasetId: datasetId === "all" ? undefined : datasetId,
          question: regenerateMessageId ? undefined : text,
          regenerateMessageId,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to send message.");
      }
      if (!response.body) throw new Error("The response stream was empty.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = done ? "" : (lines.pop() ?? "");
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as {
            type: string;
            conversationId?: string;
            value?: string;
            messageId?: string;
            suggestions?: string[];
            message?: string;
          };
          if (event.type === "meta" && event.conversationId) {
            setConversationId(event.conversationId);
            if (!conversationId)
              router.replace(
                `/dashboard/ai?conversation=${event.conversationId}`,
              );
          }
          if (event.type === "token")
            setMessages((current) =>
              current.map((item) =>
                item.id === temporaryId
                  ? { ...item, content: item.content + (event.value ?? "") }
                  : item,
              ),
            );
          if (event.type === "done")
            setMessages((current) =>
              current.map((item) =>
                item.id === temporaryId
                  ? {
                      ...item,
                      id: event.messageId ?? item.id,
                      suggestions: event.suggestions ?? [],
                    }
                  : item,
              ),
            );
          if (event.type === "error") throw new Error(event.message);
        }
        if (done) break;
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError(
          error instanceof Error ? error.message : "Unable to send message.",
        );
      setMessages((current) =>
        current.filter((item) => item.id !== temporaryId || item.content),
      );
    } finally {
      setLoading(false);
      router.refresh();
    }
  }
  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col">
      <div className="mb-4 flex justify-end">
        <Select value={datasetId} onValueChange={setDatasetId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All authorized data</SelectItem>
            {datasets.map((dataset) => (
              <SelectItem key={dataset.id} value={dataset.id}>
                {dataset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.length ? (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onSuggestion={(value) => send(value)}
                onRegenerate={() => send("", message.id)}
              />
            ))
          ) : (
            <div className="grid h-full min-h-80 place-items-center text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border bg-muted">
                  <Bot className="size-6" />
                </div>
                <h2 className="mt-4 font-semibold">
                  Ask about your business data
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Answers are restricted to authorized dashboards, datasets,
                  reports, and chart metadata.
                </p>
              </div>
            </div>
          )}
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Analyzing business data…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="border-t bg-background p-3 sm:p-4">
          <div className="flex gap-2">
            <Textarea
              aria-label="Business analytics question"
              className="min-h-12 resize-none"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(question);
                }
              }}
              placeholder="Ask about revenue, customers, products, trends…"
            />
            {loading ? (
              <Button
                size="icon"
                variant="outline"
                onClick={() => abort.current?.abort()}
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                disabled={!question.trim()}
                onClick={() => send(question)}
              >
                <Send className="size-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Local AI can make mistakes; unsupported claims are blocked by
            evidence-only context.
          </p>
        </div>
      </Card>
    </div>
  );
}
function MessageBubble({
  message,
  onSuggestion,
  onRegenerate,
}: {
  message: Message;
  onSuggestion: (value: string) => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const assistant = message.role === "ASSISTANT";
  return (
    <div className={cn("flex", assistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-4 py-3 text-sm",
          assistant
            ? "border bg-muted/30"
            : "bg-primary text-primary-foreground",
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
            {message.content}
          </ReactMarkdown>
        </div>
        {assistant && message.content ? (
          <div className="mt-3 flex flex-wrap gap-1 border-t pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(message.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={onRegenerate}>
              <RefreshCw className="size-3.5" />
              Regenerate
            </Button>
          </div>
        ) : null}
        {assistant && message.suggestions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="rounded-full border px-3 py-1 text-left text-xs hover:bg-accent"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { AiMessageRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  requestAuditMetadata,
  safeRecordAudit,
} from "@/features/audit/application/audit-service";
import {
  assertWithinUsageLimit,
  UsageLimitError,
} from "@/features/billing/application/usage-limits";

import {
  buildBusinessContext,
  isBusinessQuestion,
} from "@/features/ai-assistant/application/business-context";
import {
  aiRequest,
  cachedChat,
  chatCacheKey,
  saveAssistantMessage,
  saveChatCache,
  suggestions,
} from "@/features/ai-assistant/application/chat-service";
import { chatRequestSchema } from "@/features/ai-assistant/schemas/chat-schema";
import { createAIService } from "@/features/ai-insights/server";
import { requireOrganizationPermission } from "@/features/organizations/server/authorization";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = chatRequestSchema.parse(await request.json());
    const session = await requireOrganizationPermission(input.organizationId, {
      dataset: ["read"],
      dashboard: ["read"],
      report: ["read"],
    });
    await assertWithinUsageLimit(input.organizationId, "monthlyAI");
    let conversation = input.conversationId
      ? await prisma.aiConversation.findFirst({
          where: {
            id: input.conversationId,
            organizationId: input.organizationId,
            userId: session.user.id,
            deletedAt: null,
          },
        })
      : null;
    if (input.conversationId && !conversation)
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    let question = input.question;
    let contextDatasetId = input.datasetId;
    let regeneratedFrom: string | undefined;
    if (input.regenerateMessageId) {
      const assistant = await prisma.aiMessage.findFirst({
        where: {
          id: input.regenerateMessageId,
          role: AiMessageRole.ASSISTANT,
          conversation: {
            organizationId: input.organizationId,
            userId: session.user.id,
            deletedAt: null,
          },
        },
        include: { conversation: true },
      });
      if (!assistant)
        return NextResponse.json(
          { error: "Message not found." },
          { status: 404 },
        );
      conversation = assistant.conversation;
      regeneratedFrom = assistant.id;
      const previous = await prisma.aiMessage.findFirst({
        where: {
          conversationId: conversation.id,
          role: AiMessageRole.USER,
          createdAt: { lt: assistant.createdAt },
        },
        orderBy: { createdAt: "desc" },
      });
      question = previous?.content;
      if (
        previous?.metadata &&
        typeof previous.metadata === "object" &&
        "datasetId" in previous.metadata &&
        typeof previous.metadata.datasetId === "string"
      )
        contextDatasetId = previous.metadata.datasetId;
    }
    if (!question || !isBusinessQuestion(question))
      return NextResponse.json(
        {
          error:
            "I can only answer questions related to your business analytics data.",
        },
        { status: 422 },
      );
    if (!conversation)
      conversation = await prisma.aiConversation.create({
        data: {
          organizationId: input.organizationId,
          userId: session.user.id,
          title: question.slice(0, 80),
        },
      });
    if (!regeneratedFrom)
      await prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          userId: session.user.id,
          role: AiMessageRole.USER,
          content: question,
          metadata: { datasetId: input.datasetId ?? null },
        },
      });
    const history = await prisma.aiMessage.findMany({
      where: {
        conversationId: conversation.id,
        ...(regeneratedFrom ? { id: { not: regeneratedFrom } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { role: true, content: true },
    });
    history.reverse();
    const evidence = await buildBusinessContext(
      input.organizationId,
      question,
      contextDatasetId,
    );
    const ai = createAIService();
    const cacheKey = chatCacheKey(question, evidence, ai);
    const cached = await cachedChat(input.organizationId, cacheKey);
    const followUps = suggestions(question);
    console.info("[ai.chat] request", {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      provider: ai.provider,
      model: ai.model,
      cached: Boolean(cached),
      evidenceBytes: evidence.length,
    });
    const encoder = new TextEncoder();
    const meta = { type: "meta", conversationId: conversation.id };
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: unknown) =>
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        emit(meta);
        let output = "";
        try {
          if (cached) {
            output = cached;
            emit({ type: "token", value: output });
          } else {
            for await (const token of ai.stream({
              ...aiRequest(question!, evidence, history),
              signal: request.signal,
            })) {
              output += token;
              emit({ type: "token", value: token });
            }
            await saveChatCache(
              input.organizationId,
              cacheKey,
              evidence,
              output,
              ai,
            );
          }
          const message = await saveAssistantMessage(
            conversation!.id,
            session.user.id,
            output,
            ai,
            followUps,
            regeneratedFrom,
          );
          await safeRecordAudit({
            organizationId: input.organizationId,
            userId: session.user.id,
            action: "AI_USAGE",
            entityType: "AiMessage",
            entityId: message.id,
            description: "AI analytics assistant response generated",
            changes: {
              conversationId: conversation!.id,
              provider: ai.provider,
              model: ai.model,
              cached: Boolean(cached),
              regenerated: Boolean(regeneratedFrom),
              responseCharacters: output.length,
            },
            ...requestAuditMetadata(request),
          });
          emit({
            type: "done",
            messageId: message.id,
            suggestions: followUps,
            cached: Boolean(cached),
          });
          controller.close();
        } catch (error) {
          console.error("[ai.chat] stream failed", {
            conversationId: conversation!.id,
            message: error instanceof Error ? error.message : "Unknown",
          });
          emit({
            type: "error",
            message: "The local AI provider could not complete the response.",
          });
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to process chat request.";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "FORBIDDEN" || message === "INVALID_ORIGIN"
          ? 403
          : error instanceof UsageLimitError
            ? 402
            : error instanceof z.ZodError
              ? 400
              : 500;
    console.error("[ai.chat] request failed", { status, message });
    return NextResponse.json(
      { error: status === 500 ? "Unable to process chat request." : message },
      { status },
    );
  }
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host)
    throw new Error("INVALID_ORIGIN");
}

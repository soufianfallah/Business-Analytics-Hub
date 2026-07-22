import "server-only";

import type {
  AIRequest,
  AIService,
} from "@/features/ai-insights/domain/ai-service";
import { AIProviderError } from "@/features/ai-insights/domain/ai-service";

type OllamaChunk = { response?: string; done?: boolean; error?: string };

export class OllamaProvider implements AIService {
  readonly provider = "ollama";
  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly maxRetries: number,
  ) {}

  async generate(request: AIRequest) {
    let output = "";
    for await (const chunk of this.stream(request)) output += chunk;
    return output;
  }

  async *stream(request: AIRequest): AsyncIterable<string> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let emitted = false;
      try {
        for await (const chunk of this.attempt(request)) {
          emitted = true;
          yield chunk;
        }
        return;
      } catch (error) {
        const normalized =
          error instanceof AIProviderError
            ? error
            : new AIProviderError("Ollama request failed.", true, error);
        console.error("[ai.ollama] generation failed", {
          attempt: attempt + 1,
          model: this.model,
          retryable: normalized.retryable,
          message: normalized.message,
        });
        if (
          emitted ||
          !normalized.retryable ||
          attempt === this.maxRetries ||
          request.signal?.aborted
        )
          throw normalized;
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * 2 ** attempt + Math.random() * 150),
        );
      }
    }
  }

  private async *attempt(request: AIRequest) {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, timeout])
      : timeout;
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl.replace(/\/$/, "")}/api/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            system: request.system,
            prompt: request.prompt,
            stream: true,
            keep_alive: "5m",
            options: { temperature: 0.2 },
          }),
          signal,
        },
      );
    } catch (error) {
      throw new AIProviderError(
        error instanceof Error && error.name === "TimeoutError"
          ? "Ollama timed out."
          : "Cannot connect to Ollama. Ensure it is running locally.",
        true,
        error,
      );
    }
    if (!response.ok)
      throw new AIProviderError(
        `Ollama returned HTTP ${response.status}.`,
        response.status >= 500 || response.status === 429,
      );
    if (!response.body)
      throw new AIProviderError("Ollama returned an empty stream.", true);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaChunk;
        if (chunk.error) throw new AIProviderError(chunk.error, false);
        if (chunk.response) yield chunk.response;
      }
      if (done) break;
    }
  }
}

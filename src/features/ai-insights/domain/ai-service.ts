export type AIRequest = {
  system: string;
  prompt: string;
  signal?: AbortSignal;
};

export type AIProviderName =
  "ollama" | "mock" | "openai" | "gemini" | "anthropic" | "azure-openai";

export interface AIService {
  readonly provider: AIProviderName;
  readonly model: string;
  generate(request: AIRequest): Promise<string>;
  stream(request: AIRequest): AsyncIterable<string>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

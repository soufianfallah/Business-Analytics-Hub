import "server-only";

import type {
  AIProviderName,
  AIService,
} from "@/features/ai-insights/domain/ai-service";
import { AnthropicProvider } from "@/features/ai-insights/infrastructure/anthropic-provider";
import { AzureOpenAIProvider } from "@/features/ai-insights/infrastructure/azure-openai-provider";
import { GeminiProvider } from "@/features/ai-insights/infrastructure/gemini-provider";
import { MockProvider } from "@/features/ai-insights/infrastructure/mock-provider";
import { OllamaProvider } from "@/features/ai-insights/infrastructure/ollama-provider";
import { OpenAIProvider } from "@/features/ai-insights/infrastructure/openai-provider";
import { getServerEnv } from "@/lib/env";

export type AIProviderConfig = {
  ollamaModel: string;
  ollamaBaseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  mockResponse: string;
};

export type AIProviderBuilder = (config: AIProviderConfig) => AIService;

/** Composition root. Application services depend only on AIService. */
export class AIProviderFactory {
  constructor(
    private readonly providers: ReadonlyMap<AIProviderName, AIProviderBuilder>,
  ) {}

  create(name: AIProviderName, config: AIProviderConfig): AIService {
    const builder = this.providers.get(name);
    if (!builder) throw new Error(`Unsupported AI provider: ${name}`);
    if (name === "mock" && process.env.NODE_ENV === "production")
      throw new Error("MockProvider is disabled in production.");
    return builder(config);
  }
}

export const defaultAIProviderFactory = new AIProviderFactory(
  new Map<AIProviderName, AIProviderBuilder>([
    [
      "ollama",
      (config) =>
        new OllamaProvider(
          config.ollamaModel,
          config.ollamaBaseUrl,
          config.timeoutMs,
          config.maxRetries,
        ),
    ],
    ["mock", (config) => new MockProvider(config.mockResponse)],
    ["openai", () => new OpenAIProvider()],
    ["gemini", () => new GeminiProvider()],
    ["anthropic", () => new AnthropicProvider()],
    ["azure-openai", () => new AzureOpenAIProvider()],
  ]),
);

export function createAIService(
  factory: AIProviderFactory = defaultAIProviderFactory,
): AIService {
  const env = getServerEnv();
  return factory.create(env.AI_PROVIDER, {
    ollamaModel: env.OLLAMA_MODEL,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxRetries: env.AI_MAX_RETRIES,
    mockResponse: env.MOCK_AI_RESPONSE,
  });
}

import type {
  AIProviderName,
  AIRequest,
  AIService,
} from "@/features/ai-insights/domain/ai-service";
import { AIProviderError } from "@/features/ai-insights/domain/ai-service";

/** Shared fail-closed behavior for intentionally unconfigured integration seams. */
export abstract class UnsupportedProvider implements AIService {
  abstract readonly provider: AIProviderName;
  abstract readonly model: string;

  generate(request: AIRequest): Promise<string> {
    void request;
    return Promise.reject(this.error());
  }

  async *stream(request: AIRequest): AsyncIterable<string> {
    void request;
    throw this.error();
  }

  private error() {
    return new AIProviderError(
      `${this.provider} is a placeholder and has not been configured.`,
      false,
    );
  }
}

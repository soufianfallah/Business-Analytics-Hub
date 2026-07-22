import type {
  AIRequest,
  AIService,
} from "@/features/ai-insights/domain/ai-service";

/** Deterministic test/development provider. It never makes a network request. */
export class MockProvider implements AIService {
  readonly provider = "mock" as const;
  readonly model = "mock-deterministic";

  constructor(private readonly response = "Mock AI response.") {}

  async generate(request: AIRequest) {
    assertNotAborted(request.signal);
    return this.response;
  }

  async *stream(request: AIRequest): AsyncIterable<string> {
    assertNotAborted(request.signal);
    for (const token of this.response.match(/\S+\s*/g) ?? []) {
      assertNotAborted(request.signal);
      yield token;
    }
  }
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

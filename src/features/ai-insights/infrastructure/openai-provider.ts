import { UnsupportedProvider } from "@/features/ai-insights/infrastructure/unsupported-provider";

/** Placeholder only. No OpenAI dependency, credentials, or paid API calls. */
export class OpenAIProvider extends UnsupportedProvider {
  readonly provider = "openai" as const;
  readonly model = "not-configured";
}

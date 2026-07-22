import { UnsupportedProvider } from "@/features/ai-insights/infrastructure/unsupported-provider";

/** Placeholder only. No Gemini dependency, credentials, or paid API calls. */
export class GeminiProvider extends UnsupportedProvider {
  readonly provider = "gemini" as const;
  readonly model = "not-configured";
}

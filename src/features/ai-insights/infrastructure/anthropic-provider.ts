import { UnsupportedProvider } from "@/features/ai-insights/infrastructure/unsupported-provider";

/** Placeholder only. No Anthropic dependency, credentials, or paid API calls. */
export class AnthropicProvider extends UnsupportedProvider {
  readonly provider = "anthropic" as const;
  readonly model = "not-configured";
}

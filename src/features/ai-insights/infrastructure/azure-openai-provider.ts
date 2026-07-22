import { UnsupportedProvider } from "@/features/ai-insights/infrastructure/unsupported-provider";

/** Placeholder only. No Azure SDK, credentials, or paid API calls. */
export class AzureOpenAIProvider extends UnsupportedProvider {
  readonly provider = "azure-openai" as const;
  readonly model = "not-configured";
}

import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  UPLOAD_DIR: z.string().min(1).default(".data/uploads"),
  AI_PROVIDER: z
    .enum(["ollama", "mock", "openai", "gemini", "anthropic", "azure-openai"])
    .default("ollama"),
  OLLAMA_MODEL: z.string().min(1).default("llama3.2"),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  AI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(60_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(86_400)
    .default(3_600),
  MOCK_AI_RESPONSE: z.string().default("Mock AI response."),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_PRO_YEARLY_PRICE_ID: z.string().optional(),
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export function getServerEnv() {
  return serverSchema.parse(process.env);
}

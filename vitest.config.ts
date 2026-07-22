import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: [
        "src/features/datasets/application/infer-column-type.ts",
        "src/features/datasets/domain/column-types.ts",
        "src/features/datasets/schemas/{csv-upload-schema,dataset-query-schema}.ts",
        "src/features/reports/schemas/report-schema.ts",
        "src/features/ai-assistant/schemas/chat-schema.ts",
        "src/features/ai-insights/schemas/insight-schema.ts",
        "src/features/ai-insights/domain/ai-service.ts",
        "src/features/ai-insights/infrastructure/{mock-provider,unsupported-provider}.ts",
        "src/features/billing/domain/plans.ts",
        "src/features/billing/application/usage-limits.ts",
        "src/features/audit/application/audit-service.ts",
      ],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
});

import { describe, expect, it } from "vitest";
import { AIProviderError } from "@/features/ai-insights/domain/ai-service";
import { MockProvider } from "@/features/ai-insights/infrastructure/mock-provider";
import { UnsupportedProvider } from "@/features/ai-insights/infrastructure/unsupported-provider";

class Placeholder extends UnsupportedProvider {
  readonly provider = "gemini" as const;
  readonly model = "none";
}
describe("MockProvider", () => {
  it("generates deterministic responses", async () =>
    expect(
      await new MockProvider("Revenue is stable.").generate({
        system: "",
        prompt: "",
      }),
    ).toBe("Revenue is stable."));
  it("streams the same response", async () => {
    let result = "";
    for await (const token of new MockProvider("One two.").stream({
      system: "",
      prompt: "",
    }))
      result += token;
    expect(result).toBe("One two.");
  });
  it("respects cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new MockProvider().generate({
        system: "",
        prompt: "",
        signal: controller.signal,
      }),
    ).rejects.toBeDefined();
  });
});
describe("unsupported providers", () => {
  it("fail closed for generation", async () => {
    const provider = new Placeholder();
    await expect(
      provider.generate({ system: "", prompt: "" }),
    ).rejects.toMatchObject({ name: "AIProviderError", retryable: false });
  });
  it("fail closed for streaming", async () => {
    const iterator = new Placeholder()
      .stream({ system: "", prompt: "" })
      [Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBeInstanceOf(AIProviderError);
  });
  it("preserves provider error metadata", () => {
    const cause = new Error("network");
    const error = new AIProviderError("failed", true, cause);
    expect(error).toMatchObject({
      name: "AIProviderError",
      message: "failed",
      retryable: true,
      cause,
    });
  });
});

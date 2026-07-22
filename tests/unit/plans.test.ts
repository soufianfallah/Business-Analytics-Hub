import { describe, expect, it } from "vitest";
import { isPlanKey, plans } from "@/features/billing/domain/plans";
describe("billing plans", () => {
  it("defines increasing plan capacity", () => {
    expect(plans.free.limits.datasets).toBeLessThan(plans.pro.limits.datasets);
    expect(plans.enterprise.limits.datasets).toBe(Infinity);
    expect(plans.pro.trialDays).toBe(14);
  });
  it.each(["free", "pro", "enterprise"])("recognizes %s", (key) =>
    expect(isPlanKey(key)).toBe(true),
  );
  it("rejects unknown plans", () => expect(isPlanKey("premium")).toBe(false));
});

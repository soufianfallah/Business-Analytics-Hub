export const PLAN_KEYS = ["free", "pro", "enterprise"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type LimitedResource =
  | "members"
  | "datasets"
  | "dashboards"
  | "monthlyReports"
  | "monthlyAI"
  | "storageBytes";

export const plans = {
  free: {
    name: "Free",
    description: "For individuals exploring business analytics.",
    monthlyPrice: 0,
    trialDays: 0,
    limits: {
      members: 3,
      datasets: 3,
      dashboards: 2,
      monthlyReports: 10,
      monthlyAI: 30,
      storageBytes: 250 * 1024 ** 2,
    },
  },
  pro: {
    name: "Pro",
    description: "For growing teams that need automation and AI.",
    monthlyPrice: 29,
    trialDays: 14,
    limits: {
      members: 20,
      datasets: 50,
      dashboards: 25,
      monthlyReports: 500,
      monthlyAI: 1000,
      storageBytes: 10 * 1024 ** 3,
    },
  },
  enterprise: {
    name: "Enterprise",
    description: "For organizations requiring custom limits and support.",
    monthlyPrice: null,
    trialDays: 0,
    limits: {
      members: Infinity,
      datasets: Infinity,
      dashboards: Infinity,
      monthlyReports: Infinity,
      monthlyAI: Infinity,
      storageBytes: Infinity,
    },
  },
} as const satisfies Record<
  PlanKey,
  {
    name: string;
    description: string;
    monthlyPrice: number | null;
    trialDays: number;
    limits: Record<LimitedResource, number>;
  }
>;

export function isPlanKey(value: string): value is PlanKey {
  return PLAN_KEYS.includes(value as PlanKey);
}

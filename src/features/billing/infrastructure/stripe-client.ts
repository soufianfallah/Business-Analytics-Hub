import "server-only";

import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

export function getStripe() {
  const key = getServerEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  if (!key.startsWith("sk_test_"))
    throw new Error("Only Stripe test-mode keys are allowed in this build.");
  return new Stripe(key);
}

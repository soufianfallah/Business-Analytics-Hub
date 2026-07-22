import type { ReactNode } from "react";

import { DashboardShell } from "@/features/dashboard/components/dashboard-shell";
import { requireSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  return <DashboardShell user={session.user}>{children}</DashboardShell>;
}

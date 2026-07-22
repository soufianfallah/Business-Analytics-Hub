import "server-only";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";

export async function getPlatformAdmin() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      platformRole: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt) throw new Error("FORBIDDEN");
  const bootstrap = new Set(
    getServerEnv()
      .PLATFORM_ADMIN_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (user.platformRole !== "ADMIN" && !bootstrap.has(user.email.toLowerCase()))
    throw new Error("FORBIDDEN");
  return user;
}

export async function requirePlatformAdminPage() {
  try {
    return await getPlatformAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED")
      redirect("/login?callbackURL=/admin");
    redirect("/dashboard");
  }
}

import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { requirePlatformAdminPage } from "@/features/admin/server/authorization";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requirePlatformAdminPage();
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="size-4" />
            </span>
            Platform Admin
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {admin.email}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
                Workspace
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
    </div>
  );
}

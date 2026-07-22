import { OrganizationManager } from "@/features/organizations/components/organization-manager";
import { requireSession } from "@/lib/auth/session";

export default async function OrganizationsPage() {
  const session = await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Organizations</h1>
        <p className="mt-1 text-muted-foreground">
          Create and switch between your workspaces.
        </p>
      </div>
      <OrganizationManager userId={session.user.id} />
    </div>
  );
}

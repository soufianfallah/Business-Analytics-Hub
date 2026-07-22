import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

type HasPermissionInput = NonNullable<
  Parameters<typeof auth.api.hasPermission>[0]
>;
type OrganizationPermissions = HasPermissionInput["body"]["permissions"];

export async function requireOrganizationPermission(
  organizationId: string,
  permissions: OrganizationPermissions,
) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) throw new Error("UNAUTHENTICATED");

  const result = await auth.api.hasPermission({
    headers: requestHeaders,
    body: { organizationId, permissions },
  });
  if (!result.success) throw new Error("FORBIDDEN");

  return session;
}

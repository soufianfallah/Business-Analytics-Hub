import { AuthCard } from "@/features/auth/components/auth-card";
import { AcceptInvitation } from "@/features/organizations/components/accept-invitation";
import { getSession } from "@/lib/auth/session";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const [{ id }, session] = await Promise.all([searchParams, getSession()]);
  return (
    <AuthCard
      title="Organization invitation"
      description="Review and accept your invitation."
    >
      <AcceptInvitation invitationId={id} isAuthenticated={Boolean(session)} />
    </AuthCard>
  );
}

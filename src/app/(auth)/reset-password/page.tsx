import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthCard
      title="Choose a new password"
      description="Use at least 8 characters and keep it unique."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}

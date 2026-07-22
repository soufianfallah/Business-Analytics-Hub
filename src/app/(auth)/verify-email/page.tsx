import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { EmailActionForm } from "@/features/auth/components/email-action-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Check your inbox"
      description="Verify your email before signing in. The link expires in one hour."
      footer={
        <Link
          className="text-foreground underline underline-offset-4"
          href="/login"
        >
          Back to sign in
        </Link>
      }
    >
      <EmailActionForm purpose="verify" initialEmail={email} />
    </AuthCard>
  );
}

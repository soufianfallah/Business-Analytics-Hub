import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { EmailActionForm } from "@/features/auth/components/email-action-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we will send a secure reset link."
      footer={
        <Link
          className="text-foreground underline underline-offset-4"
          href="/login"
        >
          Back to sign in
        </Link>
      }
    >
      <EmailActionForm purpose="reset" />
    </AuthCard>
  );
}

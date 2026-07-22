import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthForm } from "@/features/auth/components/auth-form";

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Start securely analyzing data with your team."
      footer={
        <>
          Already registered?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/login"
          >
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm mode="register" />
    </AuthCard>
  );
}

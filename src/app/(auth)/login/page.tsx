import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthForm } from "@/features/auth/components/auth-form";

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your Business Analytics Hub account."
      footer={
        <>
          New here?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/register"
          >
            Create an account
          </Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthCard>
  );
}

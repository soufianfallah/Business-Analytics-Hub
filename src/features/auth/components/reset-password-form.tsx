"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { resetPasswordSchema } from "@/features/auth/schemas/auth-schemas";
import { authClient } from "@/lib/auth/auth-client";

type Values = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const form = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    if (!token)
      return setServerError(
        "This password reset link is invalid or incomplete.",
      );
    setServerError(undefined);
    const result = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });
    if (result.error)
      return setServerError(
        result.error.message ?? "Unable to reset password.",
      );
    router.push("/login?reset=success");
  }

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      {(["password", "confirmPassword"] as const).map((name) => (
        <div className="space-y-1.5" key={name}>
          <label className="text-sm font-medium" htmlFor={name}>
            {name === "password" ? "New password" : "Confirm password"}
          </label>
          <input
            id={name}
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-invalid={Boolean(form.formState.errors[name])}
            {...form.register(name)}
          />
          {form.formState.errors[name] ? (
            <p className="text-sm text-destructive">
              {form.formState.errors[name]?.message}
            </p>
          ) : null}
        </div>
      ))}
      {serverError ? (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      ) : null}
      <button
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={form.formState.isSubmitting || !token}
        type="submit"
      >
        {form.formState.isSubmitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

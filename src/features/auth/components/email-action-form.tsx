"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { emailSchema } from "@/features/auth/schemas/auth-schemas";
import { authClient } from "@/lib/auth/auth-client";

type Values = z.infer<typeof emailSchema>;

export function EmailActionForm({
  purpose,
  initialEmail = "",
}: {
  purpose: "reset" | "verify";
  initialEmail?: string;
}) {
  const [message, setMessage] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const form = useForm<Values>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: initialEmail },
  });

  async function onSubmit({ email }: Values) {
    setMessage(undefined);
    setServerError(undefined);
    const result =
      purpose === "reset"
        ? await authClient.requestPasswordReset({
            email,
            redirectTo: "/reset-password",
          })
        : await authClient.sendVerificationEmail({
            email,
            callbackURL: "/dashboard",
          });
    if (result.error)
      return setServerError(result.error.message ?? "Unable to send email.");
    setMessage(
      purpose === "reset"
        ? "If an account exists, a reset link has been sent."
        : "Verification email sent. Check your inbox.",
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      {message ? (
        <p className="text-sm text-emerald-600" role="status">
          {message}
        </p>
      ) : null}
      {serverError ? (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      ) : null}
      <button
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={form.formState.isSubmitting}
        type="submit"
      >
        {form.formState.isSubmitting
          ? "Sending…"
          : purpose === "reset"
            ? "Send reset link"
            : "Resend verification email"}
      </button>
    </form>
  );
}

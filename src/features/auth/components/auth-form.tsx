"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import type { z } from "zod";

import { authClient } from "@/lib/auth/auth-client";
import {
  loginSchema,
  registerSchema,
} from "@/features/auth/schemas/auth-schemas";

type Mode = "login" | "register";
type RegisterValues = z.infer<typeof registerSchema>;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string>();
  const isRegister = mode === "register";
  const form = useForm<RegisterValues>({
    resolver: zodResolver(
      isRegister ? registerSchema : loginSchema,
    ) as Resolver<RegisterValues>,
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterValues) {
    setServerError(undefined);
    if (isRegister) {
      const result = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
        callbackURL: "/dashboard",
      });
      if (result.error)
        return setServerError(result.error.message ?? "Registration failed.");
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
      return;
    }

    const requestedCallback = searchParams.get("callbackURL");
    const callbackURL =
      requestedCallback?.startsWith("/") && !requestedCallback.startsWith("//")
        ? requestedCallback
        : "/dashboard";
    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      callbackURL,
    });
    if (result.error)
      return setServerError(result.error.message ?? "Unable to sign in.");
    router.push(callbackURL);
    router.refresh();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      {isRegister ? (
        <Field
          label="Full name"
          type="text"
          autoComplete="name"
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />
      ) : null}
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <Field
        label="Password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      {isRegister ? (
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
      ) : null}
      {!isRegister ? (
        <div className="text-right">
          <Link
            className="text-sm underline underline-offset-4"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
      ) : null}
      {serverError ? (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      ) : null}
      <button
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={form.formState.isSubmitting}
        type="submit"
      >
        {form.formState.isSubmitting
          ? "Please wait…"
          : isRegister
            ? "Create account"
            : "Sign in"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const id = props.name ?? label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-md border bg-background px-3 py-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

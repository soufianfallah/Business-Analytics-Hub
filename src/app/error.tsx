"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        Please try again. If the problem continues, contact support.
      </p>
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}

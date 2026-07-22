"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

export function AcceptInvitation({
  invitationId,
  isAuthenticated,
}: {
  invitationId?: string;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (!invitationId)
    return (
      <p className="text-sm text-destructive">
        This invitation link is invalid.
      </p>
    );
  if (!isAuthenticated)
    return (
      <Link
        className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
        href={`/login?callbackURL=${encodeURIComponent(`/accept-invitation?id=${invitationId}`)}`}
      >
        Sign in to accept
      </Link>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Accepting will add your account to the organization.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
        disabled={pending}
        type="button"
        onClick={async () => {
          setPending(true);
          setError(undefined);
          const result = await authClient.organization.acceptInvitation({
            invitationId,
          });
          if (result.error) {
            setPending(false);
            return setError(
              result.error.message ?? "Unable to accept invitation.",
            );
          }
          router.push("/dashboard/organizations");
          router.refresh();
        }}
      >
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
    </div>
  );
}

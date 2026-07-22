"use client";

import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

export type AsyncButtonProps = ButtonProps & {
  loading?: boolean;
  loadingText?: string;
};

export const AsyncButton = forwardRef<HTMLButtonElement, AsyncButtonProps>(
  ({ children, disabled, loading = false, loadingText, ...props }, ref) => (
    <Button
      aria-busy={loading}
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : null}
      {loading && loadingText ? loadingText : children}
    </Button>
  ),
);
AsyncButton.displayName = "AsyncButton";

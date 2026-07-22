"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import type { HTMLAttributes } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this content. Please try again.",
  onRetry,
  retryLabel = "Try again",
  compact = false,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/[0.03] px-6 text-center",
        compact ? "min-h-48 py-8" : "min-h-72 py-12",
        className,
      )}
      role="alert"
      {...props}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry} size="sm" variant="outline">
          <RotateCcw className="size-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

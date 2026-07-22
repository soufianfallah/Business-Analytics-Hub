import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border bg-card p-5", className)}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-5 rounded" />
      </div>
      <Skeleton className="mt-5 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border bg-card", className)}
      aria-busy="true"
      aria-label="Loading table"
    >
      <div
        className="grid gap-4 border-b bg-muted/30 p-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton className="h-4 w-20" key={index} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          className="grid gap-4 border-b p-4 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          key={row}
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton className="h-4 w-full max-w-32" key={column} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-8", className)}
      aria-busy="true"
      aria-label="Loading page"
    >
      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-9 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

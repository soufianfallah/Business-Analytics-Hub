"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type DatasetListItem = {
  id: string;
  name: string;
  status: string;
  rowCount: string | null;
  sizeBytes: string | null;
  createdAt: string;
};
export const DatasetCard = memo(function DatasetCard({
  dataset,
}: {
  dataset: DatasetListItem;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <FileSpreadsheet className="size-5 text-emerald-600" />
          </span>
          <Badge variant="secondary">{dataset.status.toLowerCase()}</Badge>
        </div>
        <h2 className="mt-4 truncate font-semibold">{dataset.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {Number(dataset.rowCount ?? 0).toLocaleString()} rows ·{" "}
          {formatBytes(dataset.sizeBytes)}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Created {new Date(dataset.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
});

export function DatasetInfiniteGrid({
  initialItems,
  initialCursor,
}: {
  initialItems: DatasetListItem[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const marker = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/datasets?cursor=${encodeURIComponent(cursor)}&limit=24`,
      );
      if (!response.ok) return;
      const result = (await response.json()) as {
        items: DatasetListItem[];
        nextCursor: string | null;
      };
      setItems((current) => [
        ...current,
        ...result.items.filter(
          (item) => !current.some((existing) => existing.id === item.id),
        ),
      ]);
      setCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);
  useEffect(() => {
    const node = marker.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((dataset) => (
          <DatasetCard key={dataset.id} dataset={dataset} />
        ))}
      </div>
      <div
        ref={marker}
        className="flex h-16 items-center justify-center"
        aria-live="polite"
      >
        {loading ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading more datasets…
          </span>
        ) : null}
      </div>
    </>
  );
}
function formatBytes(value: string | null) {
  if (value === null) return "Unknown size";
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** exponent).toFixed(exponent > 1 ? 1 : 0)} ${units[exponent - 1]}`;
}

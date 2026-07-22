"use client";

import { useRef, useState } from "react";
import { BrainCircuit, Loader2, Sparkles, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Dataset = { id: string; name: string; columns: string[] };
export function InsightsGenerator({
  organizationId,
  datasets,
}: {
  organizationId: string;
  datasets: Dataset[];
}) {
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const dataset = datasets.find((item) => item.id === datasetId);
  const [mapping, setMapping] = useState({
    date: "",
    revenue: "",
    customerId: "",
    product: "",
    churned: "",
  });
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  function select(key: keyof typeof mapping, value: string) {
    setMapping((current) => ({
      ...current,
      [key]: value === "none" ? "" : value,
    }));
  }
  async function generate() {
    abort.current = new AbortController();
    setLoading(true);
    setOutput("");
    setError(null);
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          organizationId,
          datasetId,
          mapping: {
            ...mapping,
            customerId: mapping.customerId || undefined,
            product: mapping.product || undefined,
            churned: mapping.churned || undefined,
          },
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to generate insights.");
      }
      if (!response.body) throw new Error("The insight stream was empty.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput(
          (current) => current + decoder.decode(value, { stream: true }),
        );
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError(
          error instanceof Error
            ? error.message
            : "Unable to generate insights.",
        );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Data mapping</CardTitle>
          <CardDescription>
            Select real dataset fields used by the deterministic statistics
            engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Dataset"
            value={datasetId}
            options={datasets.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={(value) => {
              setDatasetId(value);
              setMapping({
                date: "",
                revenue: "",
                customerId: "",
                product: "",
                churned: "",
              });
            }}
          />
          {(
            ["date", "revenue", "customerId", "product", "churned"] as const
          ).map((key) => (
            <Field
              key={key}
              label={
                key === "customerId"
                  ? "Customer ID (optional)"
                  : `${key[0]!.toUpperCase()}${key.slice(1)}${["product", "churned"].includes(key) ? " (optional)" : ""}`
              }
              value={mapping[key]}
              options={[
                ...(["customerId", "product", "churned"].includes(key)
                  ? [{ value: "none", label: "Not mapped" }]
                  : []),
                ...(dataset?.columns.map((column) => ({
                  value: column,
                  label: column,
                })) ?? []),
              ]}
              onChange={(value) => select(key, value)}
            />
          ))}
          <Button
            className="w-full"
            disabled={!mapping.date || !mapping.revenue || loading}
            onClick={generate}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate insights
          </Button>
          {loading ? (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => abort.current?.abort()}
            >
              <Square className="size-3" />
              Stop
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="size-5" />
            AI insights
          </CardTitle>
          <CardDescription>
            Statistics are computed locally; Ollama only writes the narrative.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !output ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : output ? (
            <div
              aria-live="polite"
              className="whitespace-pre-wrap text-sm leading-7"
            >
              {output}
              {loading ? (
                <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-foreground" />
              ) : null}
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center text-center text-sm text-muted-foreground">
              Map dataset columns and generate an evidence-based summary.
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
function Field({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a column" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

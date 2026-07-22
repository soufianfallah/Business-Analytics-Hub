"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ColumnType,
  InferredColumn,
} from "@/features/datasets/domain/column-types";
import { MAX_CSV_BYTES } from "@/features/datasets/schemas/csv-upload-schema";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

type UploadStage =
  "idle" | "ready" | "uploading" | "processing" | "complete" | "error";
type DatasetResult = {
  id: string;
  name: string;
  rowCount: number;
  columns: InferredColumn[];
  preview: Record<string, string | null>[];
};

const TYPE_COLORS: Record<ColumnType, string> = {
  integer: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  number: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  boolean: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  date: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  datetime: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  string: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export function CsvUploader() {
  const activeOrganization = authClient.useActiveOrganization();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [dataset, setDataset] = useState<DatasetResult>();
  const [dragging, setDragging] = useState(false);

  function selectFile(nextFile?: File) {
    setError(undefined);
    setDataset(undefined);
    setProgress(0);
    if (!nextFile) return reset();
    if (!nextFile.name.toLowerCase().endsWith(".csv"))
      return fail("Choose a file with the .csv extension.");
    if (nextFile.size === 0) return fail("The selected file is empty.");
    if (nextFile.size > MAX_CSV_BYTES)
      return fail("CSV files may be up to 2 GB.");
    setFile(nextFile);
    setStage("ready");
  }

  async function upload() {
    if (!file || !activeOrganization.data)
      return fail("Select an active organization before uploading.");
    setStage("uploading");
    setProgress(0);
    setError(undefined);
    try {
      const initialization = await fetch("/api/uploads/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganization.data.id,
          fileName: file.name,
          mimeType: file.type || "text/csv",
          sizeBytes: file.size,
        }),
      });
      const initialized = (await initialization.json()) as {
        uploadUrl?: string;
        error?: string;
      };
      if (!initialization.ok || !initialized.uploadUrl)
        throw new Error(initialized.error ?? "Unable to initialize upload.");
      const result = await uploadFile(
        initialized.uploadUrl,
        file,
        (percentage) => {
          setProgress(percentage);
          if (percentage === 100) setStage("processing");
        },
      );
      setDataset(result);
      setStage("complete");
    } catch (uploadError) {
      fail(
        uploadError instanceof Error
          ? uploadError.message
          : "CSV upload failed.",
      );
    }
  }

  function fail(message: string) {
    setError(message);
    setStage("error");
  }

  function reset() {
    setFile(undefined);
    setDataset(undefined);
    setError(undefined);
    setProgress(0);
    setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (activeOrganization.isPending)
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Loading workspace…
        </CardContent>
      </Card>
    );
  if (!activeOrganization.data)
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="No active organization"
        description="Create or select an organization before uploading a CSV dataset."
      />
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Files are streamed directly to storage and may be up to 2 GB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <input
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          {!file ? (
            <button
              className={cn(
                "flex min-h-56 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30",
              )}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFile(event.dataTransfer.files[0]);
              }}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <UploadCloud className="size-6 text-muted-foreground" />
              </span>
              <span className="mt-4 text-sm font-medium">
                Drop your CSV here or click to browse
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Maximum size: 2 GB · Header row required
              </span>
            </button>
          ) : (
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <FileSpreadsheet className="size-5 text-emerald-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                {stage === "ready" || stage === "error" ? (
                  <Button onClick={reset} size="icon" variant="ghost">
                    <X className="size-4" />
                    <span className="sr-only">Remove file</span>
                  </Button>
                ) : null}
              </div>
              {stage === "uploading" || stage === "processing" ? (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>
                      {stage === "processing"
                        ? "Validating and inferring columns…"
                        : "Uploading…"}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              ) : null}
            </div>
          )}
          {error ? (
            <div
              className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Upload failed</p>
                <p className="mt-1 text-destructive/80">{error}</p>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            {stage === "error" ? (
              <Button onClick={upload} variant="outline" disabled={!file}>
                <RefreshCw className="size-4" />
                Re-upload
              </Button>
            ) : null}
            {stage === "ready" ? (
              <Button onClick={upload}>
                <UploadCloud className="size-4" />
                Upload and create dataset
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {dataset ? <DatasetPreview dataset={dataset} onReupload={reset} /> : null}
    </div>
  );
}

function DatasetPreview({
  dataset,
  onReupload,
}: {
  dataset: DatasetResult;
  onReupload: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <CardTitle>{dataset.name}</CardTitle>
          </div>
          <CardDescription className="mt-2">
            Dataset created with {dataset.rowCount.toLocaleString()} rows and{" "}
            {dataset.columns.length} columns.
          </CardDescription>
        </div>
        <Button onClick={onReupload} size="sm" variant="outline">
          <RefreshCw className="size-4" />
          Upload another
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {dataset.columns.map((column) => (
            <Badge
              className={TYPE_COLORS[column.type]}
              key={column.name}
              variant="secondary"
            >
              {column.name}: {column.type}
              {column.nullable ? "?" : ""}
            </Badge>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {dataset.columns.map((column) => (
                  <TableHead className="whitespace-nowrap" key={column.name}>
                    {column.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataset.preview.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {dataset.columns.map((column) => (
                    <TableCell
                      className="max-w-64 truncate whitespace-nowrap"
                      key={column.name}
                    >
                      {row[column.name] ?? (
                        <span className="text-muted-foreground">null</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Previewing the first {dataset.preview.length} rows. Raw CSV data
          remains stored unchanged.
        </p>
      </CardContent>
    </Card>
  );
}

function uploadFile(
  url: string,
  file: File,
  onProgress: (percentage: number) => void,
) {
  return new Promise<DatasetResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type || "text/csv");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(new Error("The network connection was interrupted."));
    request.onload = () => {
      let response: { dataset?: DatasetResult; error?: string };
      try {
        response = JSON.parse(request.responseText) as typeof response;
      } catch {
        return reject(new Error("The server returned an invalid response."));
      }
      if (request.status < 200 || request.status >= 300 || !response.dataset)
        return reject(new Error(response.error ?? "CSV processing failed."));
      resolve(response.dataset);
    };
    request.send(file);
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** exponent).toFixed(exponent > 1 ? 1 : 0)} ${units[exponent - 1]}`;
}

"use client";

import { useState } from "react";
import { Download, FilePlus2, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DatasetOption = { id: string; name: string };
type ReportItem = {
  id: string;
  name: string;
  description: string | null;
  format: "PDF" | "CSV" | "XLSX";
  schedule: { cron: string; nextRunAt: string } | null;
  runs: Array<{
    id: string;
    status: string;
    format: string;
    createdAt: string;
  }>;
};

export function ReportManager({
  organizationId,
  datasets,
  reports,
}: {
  organizationId: string;
  datasets: DatasetOption[];
  reports: ReportItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const [format, setFormat] = useState<"PDF" | "CSV" | "XLSX">("PDF");
  const [template, setTemplate] = useState(false);
  const [frequency, setFrequency] = useState("none");
  const [recipients, setRecipients] = useState("");
  async function create() {
    setBusy("create");
    setError(null);
    try {
      const emails = recipients
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name,
          datasetId,
          format,
          columns: [],
          saveAsTemplate: template,
          schedule:
            frequency === "none"
              ? undefined
              : {
                  frequency,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  recipients: emails,
                },
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to create report.");
      setName("");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to create report.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function generate(reportId: string, exportFormat: string) {
    setBusy(reportId);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format: exportFormat, recipients: [] }),
      });
      const result = (await response.json()) as {
        runId?: string;
        error?: string;
      };
      if (!response.ok || !result.runId)
        throw new Error(result.error ?? "Generation failed.");
      window.location.assign(`/api/report-runs/${result.runId}/download`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="size-5" />
            Create report
          </CardTitle>
          <CardDescription>
            Build an export, save it as a template, or deliver it on a schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-6">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="report-name">Name</Label>
            <Input
              id="report-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Monthly sales"
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Dataset</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose dataset" />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default format</Label>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as typeof format)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="XLSX">Excel</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Schedule</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Manual</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {frequency !== "none" ? (
            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="recipients">Email recipients</Label>
              <Input
                id="recipients"
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
                placeholder="finance@example.com, owner@example.com"
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 self-end pb-2 text-sm lg:col-span-1">
            <input
              type="checkbox"
              checked={template}
              onChange={(event) => setTemplate(event.target.checked)}
              className="size-4 rounded border"
            />
            Save template
          </label>
          <Button
            className="self-end"
            disabled={!name.trim() || !datasetId || busy === "create"}
            onClick={create}
          >
            {busy === "create" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Create
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{report.name}</CardTitle>
                <CardDescription>
                  {report.description ?? "Dataset report"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{report.format}</Badge>
                {report.schedule ? <Badge>Scheduled</Badge> : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {report.schedule
                    ? `Next delivery ${new Date(report.schedule.nextRunAt).toLocaleString()}`
                    : `${report.runs.length} recent generation${report.runs.length === 1 ? "" : "s"}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["PDF", "XLSX", "CSV"] as const).map((item) => (
                    <Button
                      key={item}
                      size="sm"
                      variant="outline"
                      disabled={busy === report.id}
                      onClick={() => generate(report.id, item)}
                    >
                      {busy === report.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      {item === "XLSX" ? "Excel" : item}
                    </Button>
                  ))}
                </div>
              </div>
              {report.runs.length ? (
                <div className="mt-4 divide-y rounded-lg border">
                  {report.runs.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>
                        {run.format} ·{" "}
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                      {run.status === "COMPLETED" ? (
                        <Button asChild size="sm" variant="ghost">
                          <a href={`/api/report-runs/${run.id}/download`}>
                            <Download className="size-4" />
                            Download
                          </a>
                        </Button>
                      ) : (
                        <Badge variant="outline">{run.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

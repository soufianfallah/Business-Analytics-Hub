import { CsvUploader } from "@/features/datasets/components/csv-uploader";
import { requireSession } from "@/lib/auth/session";

export default async function CsvUploadPage() {
  await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Datasets</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Import CSV
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Validate, preview, and turn raw CSV data into an analytics-ready
          dataset.
        </p>
      </div>
      <CsvUploader />
    </div>
  );
}

# CSV upload architecture

## Request flow

1. The browser validates extension, non-zero size, and the 2 GB application limit.
2. `POST /api/uploads/csv` validates metadata with Zod, authenticates the session, verifies `dataset:create` permission, and creates a `CsvUpload` record.
3. The browser sends the raw `File` body to the returned `PUT` URL. `XMLHttpRequest` reports byte-level progress without converting the file to base64 or multipart form data.
4. The Node route streams bytes into an atomic `.part` file while enforcing the declared byte count, rejecting binary content, and calculating SHA-256.
5. The raw file is parsed row-by-row. Only 20 preview rows and 1,000 inference rows remain in memory; the full CSV is never loaded into RAM.
6. Prisma creates the `Dataset` and completes the `CsvUpload` in one transaction. The unchanged raw CSV remains available for reprocessing and auditing.

## Large-file decision

Server Actions and `request.formData()` are intentionally avoided because platform and multipart parsers can buffer large bodies. The raw streaming endpoint supports files above 100 MB and enforces a 2 GB product limit. `maxDuration = 900` allows long parsing on a Node deployment.

The included storage adapter uses `UPLOAD_DIR`, defaulting to `.data/uploads`. This suits local development or a single-node deployment with a durable mounted volume. For serverless or horizontally scaled infrastructure, replace `csv-storage.ts` with S3, R2, or Azure Blob multipart uploads and queue parsing in a worker.

## Validation and inference

- Client checks improve feedback; server checks are authoritative.
- Headers must be present and unique, with at most 500 columns.
- Records must match the header width; individual records are limited to 10 MB.
- NUL bytes reject obvious binary files.
- Types widen safely: `integer → number → string` and `date → datetime → string`.
- Empty values set `nullable` without forcing a string type.
- Parser errors are stored in `CsvUpload.errorDetails` and returned as actionable messages.

## Security and recovery

Both endpoints require a validated Better Auth session, same-origin browser request, organization membership, and `dataset:create` permission. The authenticated user must own the upload record. Storage paths derive only from validated UUIDs. Failed partial files are removed, failed database records remain auditable, and re-upload creates a clean attempt.

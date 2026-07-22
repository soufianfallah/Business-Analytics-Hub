import "server-only";

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { getServerEnv } from "@/lib/env";

function storageRoot() {
  return path.resolve(process.cwd(), getServerEnv().UPLOAD_DIR);
}

function assertUploadId(uploadId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      uploadId,
    )
  ) {
    throw new Error("INVALID_UPLOAD_ID");
  }
}

export function csvStorageKey(uploadId: string) {
  assertUploadId(uploadId);
  return `csv/${uploadId}.csv`;
}

export function csvStoragePath(uploadId: string) {
  assertUploadId(uploadId);
  return path.join(storageRoot(), "csv", `${uploadId}.csv`);
}

export function createCsvReadStream(uploadId: string) {
  return createReadStream(csvStoragePath(uploadId));
}

export async function writeCsvStream(
  uploadId: string,
  stream: NodeJS.ReadableStream,
) {
  const destination = csvStoragePath(uploadId);
  const temporary = `${destination}.part`;
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await pipeline(stream, createWriteStream(temporary, { flags: "wx" }));
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function removeCsv(uploadId: string) {
  await rm(csvStoragePath(uploadId), { force: true });
}

import "server-only";

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { getServerEnv } from "@/lib/env";

function root() {
  return path.resolve(getServerEnv().UPLOAD_DIR, "reports");
}

export function reportStorageKey(runId: string, extension: string) {
  return `${runId}.${extension}`;
}

export async function saveReport(key: string, buffer: Buffer) {
  await mkdir(root(), { recursive: true });
  await writeFile(path.join(root(), path.basename(key)), buffer);
}

export async function readReport(key: string) {
  return readFile(path.join(root(), path.basename(key)));
}

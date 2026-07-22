import "server-only";

import { PassThrough } from "node:stream";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ReportFormat, ReportRunStatus, ReportTrigger } from "@prisma/client";

import { assertWithinUsageLimit } from "@/features/billing/application/usage-limits";
import { safeRecordAudit } from "@/features/audit/application/audit-service";
import {
  reportStorageKey,
  saveReport,
} from "@/features/reports/infrastructure/report-storage";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/email";

type ReportConfiguration = { columns?: string[] };

export async function generateReport(
  reportId: string,
  format: ReportFormat,
  recipients: string[] = [],
  trigger: ReportTrigger = ReportTrigger.MANUAL,
) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, deletedAt: null },
    include: { dataset: true },
  });
  if (!report?.dataset) throw new Error("Report dataset was not found.");
  await assertWithinUsageLimit(report.organizationId, "monthlyReports");
  const run = await prisma.reportRun.create({
    data: {
      reportId,
      format,
      recipients,
      trigger,
      status: ReportRunStatus.GENERATING,
      startedAt: new Date(),
    },
  });
  try {
    const configured =
      (report.configuration as ReportConfiguration).columns ?? [];
    const rows = await prisma.datasetRow.findMany({
      where: { datasetId: report.dataset.id },
      orderBy: { rowNumber: "asc" },
      select: { data: true },
      take: 100_000,
    });
    const records = rows.map((row) => row.data as Record<string, unknown>);
    const columns = configured.length
      ? configured
      : [...new Set(records.flatMap((row) => Object.keys(row)))];
    const output = await render(format, report.name, columns, records);
    const extension =
      format === ReportFormat.XLSX ? "xlsx" : format.toLowerCase();
    const key = reportStorageKey(run.id, extension);
    await saveReport(key, output);
    if (recipients.length)
      await sendEmail({
        to: recipients,
        subject: `${report.name} report`,
        text: `Your scheduled report “${report.name}” is attached.`,
        html: `<p>Your scheduled report <strong>${escapeHtml(report.name)}</strong> is attached.</p>`,
        attachments: [
          {
            filename: `${safeName(report.name)}.${extension}`,
            content: output,
          },
        ],
      });
    await prisma.$transaction([
      prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: ReportRunStatus.COMPLETED,
          storageKey: key,
          sizeBytes: BigInt(output.length),
          completedAt: new Date(),
        },
      }),
      prisma.report.update({
        where: { id: reportId },
        data: {
          status: "READY",
          format,
          storageKey: key,
          generatedAt: new Date(),
          failureReason: null,
        },
      }),
    ]);
    await safeRecordAudit({
      organizationId: report.organizationId,
      action: "GENERATE",
      entityType: "ReportRun",
      entityId: run.id,
      description: "Report generation completed",
      changes: {
        reportId,
        format,
        trigger,
        sizeBytes: output.length,
        emailedRecipients: recipients.length,
      },
    });
    return run.id;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Report generation failed.";
    await prisma.$transaction([
      prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: ReportRunStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      }),
      prisma.report.update({
        where: { id: reportId },
        data: { status: "FAILED", failureReason: message },
      }),
    ]);
    throw error;
  }
}

async function render(
  format: ReportFormat,
  title: string,
  columns: string[],
  rows: Record<string, unknown>[],
) {
  if (format === ReportFormat.CSV)
    return Buffer.from(
      [
        columns.map(csvCell).join(","),
        ...rows.map((row) =>
          columns.map((column) => csvCell(row[column])).join(","),
        ),
      ].join("\r\n"),
    );
  if (format === ReportFormat.XLSX) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Business Analytics Hub";
    const sheet = workbook.addWorksheet("Report", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = columns.map((column) => ({
      header: column,
      key: column,
      width: 20,
    }));
    rows.forEach((row) =>
      sheet.addRow(
        Object.fromEntries(
          columns.map((column) => [column, scalar(row[column])]),
        ),
      ),
    );
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" },
    };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(columns.length, 1) },
    };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  return renderPdf(title, columns, rows);
}

function renderPdf(
  title: string,
  columns: string[],
  rows: Record<string, unknown>[],
) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      margin: 36,
      size: "A4",
      layout: columns.length > 5 ? "landscape" : "portrait",
    });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    document.pipe(stream);
    document
      .fontSize(20)
      .text(title)
      .moveDown(0.4)
      .fontSize(9)
      .fillColor("#64748b")
      .text(`Generated ${new Date().toISOString()}`)
      .moveDown();
    document.fillColor("#111827").fontSize(8).text(columns.join("  |  "));
    document
      .moveTo(36, document.y + 3)
      .lineTo(document.page.width - 36, document.y + 3)
      .stroke("#cbd5e1")
      .moveDown(0.7);
    for (const row of rows.slice(0, 5000)) {
      if (document.y > document.page.height - 45) document.addPage();
      document
        .fillColor("#334155")
        .text(
          columns.map((column) => String(scalar(row[column]))).join("  |  "),
          { lineBreak: false, ellipsis: true, width: document.page.width - 72 },
        );
    }
    document.end();
  });
}

const scalar = (value: unknown): string | number | boolean =>
  value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : (value as string | number | boolean);
const csvCell = (value: unknown) =>
  `"${String(scalar(value)).replaceAll('"', '""')}"`;
const safeName = (value: string) =>
  value.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

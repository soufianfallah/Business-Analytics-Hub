import "server-only";

import nodemailer from "nodemailer";

import { getServerEnv } from "@/lib/env";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
};

export async function sendEmail(input: SendEmailInput) {
  const env = getServerEnv();
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  await transport.sendMail({ from: env.EMAIL_FROM, ...input });
}

export function authEmail(params: {
  heading: string;
  message: string;
  url: string;
  action: string;
}) {
  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  const safeUrl = params.url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const heading = escapeHtml(params.heading);
  const message = escapeHtml(params.message);
  const action = escapeHtml(params.action);
  return {
    text: `${params.heading}\n\n${params.message}\n\n${params.action}: ${params.url}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:24px">${heading}</h1><p>${message}</p><p><a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">${action}</a></p><p style="color:#64748b;font-size:14px">If you did not request this, you can safely ignore this email.</p></div>`,
  };
}

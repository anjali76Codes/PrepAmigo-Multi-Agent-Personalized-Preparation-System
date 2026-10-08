import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

let transporter: Transporter | null = null;
let warnedDisabled = false;

function getTransporter(): Transporter | null {
  if (!config.SMTP_HOST) {
    if (!warnedDisabled) {
      logger.warn("SMTP_HOST is not set; outbound email is disabled (digest emails will be skipped).");
      warnedDisabled = true;
    }
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
      // Nodemailer's defaults (2 min connect, 10 min idle) let a bad host stall a request or the digest job.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendMailResult {
  delivered: boolean;
  /** Why it wasn't delivered: SMTP unconfigured, or the SMTP server's error (e.g. "535 ... Username and Password not accepted"). */
  error?: string;
}

/** Sends an email; reports failure (and logs it) instead of throwing. */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const client = getTransporter();
  if (!client) return { delivered: false, error: "SMTP_HOST is not set; outbound email is disabled." };
  try {
    await client.sendMail({ from: config.MAIL_FROM, ...input });
    return { delivered: true };
  } catch (error) {
    logger.error("Failed to send email", { error, to: input.to });
    return { delivered: false, error: error instanceof Error ? error.message : String(error) };
  }
}

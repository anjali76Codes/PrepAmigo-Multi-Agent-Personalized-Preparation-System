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

/** Sends an email; returns false (and logs) instead of throwing when SMTP is unconfigured or the send fails. */
export async function sendMail(input: SendMailInput): Promise<boolean> {
  const client = getTransporter();
  if (!client) return false;
  try {
    await client.sendMail({ from: config.MAIL_FROM, ...input });
    return true;
  } catch (error) {
    logger.error("Failed to send email", { error, to: input.to });
    return false;
  }
}

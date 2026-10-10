import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),
  ENABLE_AUTH: z.string().optional().transform((value) =>
    value === undefined ? undefined : ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()),
  ),
  MONGODB_URI: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  JWT_SECRET: z.string(),
  FRONTEND_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  AGENTS_SERVICE_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/, ""))
    .default("http://localhost:8000"),
  SERPAPI_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().optional(),
  LLM_PROVIDER: z.string().default("gemini"),

  // SMTP for outbound email (morning digest, etc). Blank SMTP_HOST disables sending.
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().optional().transform((value) =>
    value === undefined ? false : ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()),
  ),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  MAIL_FROM: z.string().optional().default("PrepAmigo <no-reply@prepamigo.app>"),

  // Morning task-digest email + its matching dashboard notification.
  ENABLE_DAILY_DIGEST: z.string().optional().transform((value) =>
    value === undefined ? true : ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()),
  ),
  DAILY_DIGEST_HOUR: z.coerce.number().min(0).max(23).default(7),
  // POST /api/notifications/test-digest. Unset: on outside production, off in production.
  ENABLE_TEST_NOTIFICATIONS: z.string().optional().transform((value) =>
    value === undefined ? undefined : ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()),
  ),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables:", _env.error.format());
  process.exit(1);
}

if ((_env.data.ENABLE_AUTH || _env.data.NODE_ENV === "production") && !_env.data.JWT_SECRET.trim()) {
  console.error("JWT_SECRET must be set when authentication is enabled or NODE_ENV=production.");
  process.exit(1);
}

if (
  _env.data.NODE_ENV === "production" &&
  ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(_env.data.AGENTS_SERVICE_URL).hostname)
) {
  console.error("AGENTS_SERVICE_URL must point to the deployed agent service when NODE_ENV=production.");
  process.exit(1);
}

export const config = _env.data;

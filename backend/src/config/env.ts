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
  AGENTS_SERVICE_URL: z.string().default("http://localhost:8000"),
  SERPAPI_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().optional(),
  LLM_PROVIDER: z.string().default("gemini"),
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

export const config = _env.data;

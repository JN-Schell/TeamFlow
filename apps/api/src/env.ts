import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config({ path: path.resolve(process.cwd(), "../../.env") });
config();

const optionalBoolean = z
  .string()
  .optional()
  .transform((value) => (value === undefined ? undefined : value.toLowerCase() === "true"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  SOCKET_CORS_ORIGIN: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_SECURE: optionalBoolean,
  COOKIE_DOMAIN: z.string().optional(),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),
  RATE_LIMIT_DISABLED: optionalBoolean,
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(10),
  EMAIL_PROVIDER: z.enum(["log", "smtp"]).default("log"),
  EMAIL_FROM: z.string().min(3).default("TeamFlow <no-reply@teamflow.local>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: optionalBoolean,
  EMAIL_WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  EMAIL_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  EMAIL_RETRY_BASE_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === "production";

if (isProd && !raw.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET must be set in production");
}

if (raw.EMAIL_PROVIDER === "smtp" && !raw.SMTP_HOST) {
  throw new Error("SMTP_HOST must be set when EMAIL_PROVIDER=smtp");
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProd,
  port: raw.PORT,
  databaseUrl: raw.DATABASE_URL,
  clientOrigins: raw.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
  publicApiUrl: raw.PUBLIC_API_URL.replace(/\/$/, ""),
  socketOrigins:
    raw.SOCKET_CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ??
    raw.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
  jwtAccessSecret: raw.JWT_ACCESS_SECRET ?? "development-only-insecure-secret-change-me",
  accessTtlMinutes: raw.ACCESS_TOKEN_TTL_MINUTES,
  refreshTtlDays: raw.REFRESH_TOKEN_TTL_DAYS,
  cookieSecure: raw.COOKIE_SECURE ?? isProd,
  cookieDomain: raw.COOKIE_DOMAIN || undefined,
  uploadDir: path.resolve(process.cwd(), raw.UPLOAD_DIR),
  maxUploadBytes: raw.MAX_UPLOAD_MB * 1024 * 1024,
  rateLimitDisabled: raw.RATE_LIMIT_DISABLED ?? raw.NODE_ENV === "test",
  authRateLimitMax: raw.AUTH_RATE_LIMIT_MAX,
  emailProvider: raw.EMAIL_PROVIDER,
  emailFrom: raw.EMAIL_FROM,
  smtpHost: raw.SMTP_HOST,
  smtpPort: raw.SMTP_PORT,
  smtpUser: raw.SMTP_USER,
  smtpPass: raw.SMTP_PASS,
  smtpSecure: raw.SMTP_SECURE ?? raw.SMTP_PORT === 465,
  emailWorkerIntervalMs: raw.EMAIL_WORKER_INTERVAL_MS,
  emailBatchSize: raw.EMAIL_BATCH_SIZE,
  emailMaxAttempts: raw.EMAIL_MAX_ATTEMPTS,
  emailRetryBaseMs: raw.EMAIL_RETRY_BASE_MS,
};

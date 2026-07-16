import { z } from "zod";

const hasCloudVars = !!(
  process.env.R2_ENDPOINT ||
  process.env.RESEND_API_KEY ||
  process.env.UPSTASH_REDIS_REST_URL
);
const isProduction = process.env.NODE_ENV === "production" && hasCloudVars;

const coreSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),
  DATABASE_APP_URL: z.string().url("DATABASE_APP_URL must be a valid PostgreSQL URL (role without BYPASSRLS)"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters (run: openssl rand -base64 32)"),
  NEXTAUTH_URL: z
    .string()
    .url("NEXTAUTH_URL must be a valid URL")
    .optional(),
  MERCADOPAGO_ACCESS_TOKEN: z
    .string()
    .min(1, "MERCADOPAGO_ACCESS_TOKEN is required for checkout and webhooks"),
});

const productionSchema = coreSchema.extend({
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url("UPSTASH_REDIS_REST_URL must be a valid URL in production"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required in production"),
  RESEND_API_KEY: z
    .string()
    .min(1, "RESEND_API_KEY is required in production for email delivery"),
  R2_ENDPOINT: z
    .string()
    .url("R2_ENDPOINT must be a valid URL in production"),
  R2_ACCESS_KEY_ID: z
    .string()
    .min(1, "R2_ACCESS_KEY_ID is required in production"),
  R2_SECRET_ACCESS_KEY: z
    .string()
    .min(1, "R2_SECRET_ACCESS_KEY is required in production"),
  R2_BUCKET_NAME: z
    .string()
    .min(1, "R2_BUCKET_NAME is required in production"),
  MERCADOPAGO_WEBHOOK_SECRET: z
    .string()
    .min(1, "MERCADOPAGO_WEBHOOK_SECRET is required in production"),
  STOREFRONT_URL: z
    .string()
    .url("STOREFRONT_URL must be a valid URL in production"),
  SENTRY_DSN: z.string().url("SENTRY_DSN must be a valid URL").optional(),
});

const developmentSchema = coreSchema.extend({
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  STOREFRONT_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

type SafeParseResult = ReturnType<typeof coreSchema.safeParse>;

function formatValidationError(result: SafeParseResult): string {
  if (result.success) return "";

  const issues = result.error.issues || [];
  const messages = issues.map((issue) => {
    const key = Array.isArray(issue.path)
      ? issue.path.join(".")
      : String(issue.path || "unknown");
    return `  - ${key}: ${issue.message}`;
  });

  return [
    `\n❌ Invalid environment variables for ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}:`,
    ...messages,
    `\nCheck your .env.local file against .env.local.example\n`,
  ].join("\n");
}

export function validateEnv(): void {
  const schema = isProduction ? productionSchema : developmentSchema;
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const error = formatValidationError(result);
    console.error(error);
    throw new Error(error);
  }

  if (isProduction) {
    console.log("[Env] All production environment variables validated successfully");
  }
}

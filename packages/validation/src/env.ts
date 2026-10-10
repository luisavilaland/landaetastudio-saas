import { z } from 'zod'

const hasCloudVars = !!(
  process.env.R2_ENDPOINT ||
  process.env.RESEND_API_KEY ||
  process.env.UPSTASH_REDIS_REST_URL
)
const isProduction = process.env.NODE_ENV === 'production' && hasCloudVars

const coreSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  DATABASE_APP_URL: z
    .string()
    .url(
      'DATABASE_APP_URL must be a valid PostgreSQL URL (role without BYPASSRLS)',
    ),
  AUTH_SECRET: z
    .string()
    .min(
      32,
      'AUTH_SECRET must be at least 32 characters (run: openssl rand -base64 32)',
    ),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL').optional(),
  MERCADOPAGO_ACCESS_TOKEN: z
    .string()
    .min(1, 'MERCADOPAGO_ACCESS_TOKEN is required for checkout and webhooks'),
  MP_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, 'MP_TOKEN_ENCRYPTION_KEY must be at least 32 characters'),
})

const productionSchema = coreSchema.extend({
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url('UPSTASH_REDIS_REST_URL must be a valid URL in production'),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, 'UPSTASH_REDIS_REST_TOKEN is required in production'),
  RESEND_API_KEY: z
    .string()
    .min(1, 'RESEND_API_KEY is required in production for email delivery'),
  R2_ENDPOINT: z.string().url('R2_ENDPOINT must be a valid URL in production'),
  R2_ACCESS_KEY_ID: z
    .string()
    .min(1, 'R2_ACCESS_KEY_ID is required in production'),
  R2_SECRET_ACCESS_KEY: z
    .string()
    .min(1, 'R2_SECRET_ACCESS_KEY is required in production'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required in production'),
  MERCADOPAGO_WEBHOOK_SECRET: z
    .string()
    .min(1, 'MERCADOPAGO_WEBHOOK_SECRET is required in production'),
  MP_PLATFORM_ACCESS_TOKEN: z
    .string()
    .min(1, 'MP_PLATFORM_ACCESS_TOKEN is required in production'),
  MP_PLATFORM_WEBHOOK_SECRET: z
    .string()
    .min(1, 'MP_PLATFORM_WEBHOOK_SECRET is required in production'),
  STOREFRONT_URL: z
    .string()
    .url('STOREFRONT_URL must be a valid URL in production'),
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional(),
  // Fase 3 (D1): host que sirve la superficie de la plataforma (landing,
  // registro). Sin esto el proxy del storefront devuelve 404 en ese host
  // porque no hay tenant que resolver.
  //
  // Se valida como host sin puerto ni esquema, porque es contra lo que se
  // compara el `host` de la request (proxy.ts:26 le saca el puerto). Aceptar
  // `https://app.example.com` aca seria un error silencioso: la comparacion
  // nunca matchearia y el fallback 404 seguiria.
  PLATFORM_HOST: z
    .string()
    .regex(
      /^[a-z0-9.-]+$/i,
      'PLATFORM_HOST must be a bare hostname, without scheme or port',
    )
    .optional(),
  // Fase 3 (T4): habilita los fallbacks de desarrollo del proxy del storefront
  // (`localhost -> tienda1` y `DEFAULT_TENANT_SLUG`).
  //
  // Deliberadamente NO se deriva de NODE_ENV: Preview de Vercel no es
  // development ni production, es un tercer estado. Una env var explicita la
  // decide el humano y queda en el audit trail; `NODE_ENV === 'development'` es
  // una suposicion que en Preview es falsa sin producir ningun error visible.
  //
  // Tiene que ser el string exacto `'true'`. Cualquier otra cosa -`'1'`,
  // `'TRUE'`, `'yes'`- lo deja apagado: es fail-closed, y el costo de un
  // fallback apagado de mas es un 404 visible, no un tenant equivocado servido.
  ENABLE_DEFAULT_TENANT_FALLBACK: z.literal('true').optional(),
})

const developmentSchema = coreSchema.extend({
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  // Fase 2: sin esto los handlers de suscripciones devuelven 500
  // ("MercadoPago no configurado") en vez de romper el arranque.
  MP_PLATFORM_ACCESS_TOKEN: z.string().optional(),
  MP_PLATFORM_WEBHOOK_SECRET: z.string().optional(),
  STOREFRONT_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  PLATFORM_HOST: z
    .string()
    .regex(
      /^[a-z0-9.-]+$/i,
      'PLATFORM_HOST must be a bare hostname, without scheme or port',
    )
    .optional(),
})

type SafeParseResult = ReturnType<typeof coreSchema.safeParse>

function formatValidationError(result: SafeParseResult): string {
  if (result.success) return ''

  const issues = result.error.issues || []
  const messages = issues.map((issue) => {
    const key = Array.isArray(issue.path)
      ? issue.path.join('.')
      : String(issue.path || 'unknown')
    return `  - ${key}: ${issue.message}`
  })

  return [
    `\n❌ Invalid environment variables for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}:`,
    ...messages,
    `\nCheck your .env.local file against .env.local.example\n`,
  ].join('\n')
}

export function validateEnv(): void {
  const schema = isProduction ? productionSchema : developmentSchema
  const result = schema.safeParse(process.env)

  if (!result.success) {
    const error = formatValidationError(result)
    console.error(error)
    throw new Error(error)
  }

  if (isProduction) {
    console.log(
      '[Env] All production environment variables validated successfully',
    )
  }
}

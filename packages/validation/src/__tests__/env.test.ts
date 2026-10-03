import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function setRequiredEnvironment(): void {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', 'postgresql://owner:password@localhost:5432/test')
  vi.stubEnv(
    'DATABASE_APP_URL',
    'postgresql://app_user:password@localhost:5432/test',
  )
  vi.stubEnv('AUTH_SECRET', 'a'.repeat(32))
  vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'APP_USR-test')
}

async function loadValidateEnv(): Promise<() => void> {
  const { validateEnv } = await import('../env')
  return validateEnv
}

describe('validateEnv', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    setRequiredEnvironment()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('rejects MP_TOKEN_ENCRYPTION_KEY when it is missing', async () => {
    vi.stubEnv('MP_TOKEN_ENCRYPTION_KEY', undefined)

    const validateEnv = await loadValidateEnv()

    expect(() => validateEnv()).toThrow(/MP_TOKEN_ENCRYPTION_KEY/)
  })

  it('rejects MP_TOKEN_ENCRYPTION_KEY when it is shorter than 32 characters', async () => {
    vi.stubEnv('MP_TOKEN_ENCRYPTION_KEY', 'too-short')

    const validateEnv = await loadValidateEnv()

    expect(() => validateEnv()).toThrow(/at least 32 characters/)
  })

  it('accepts the required key when the platform variables are absent', async () => {
    vi.stubEnv('MP_TOKEN_ENCRYPTION_KEY', 'k'.repeat(32))
    vi.stubEnv('MP_PLATFORM_ACCESS_TOKEN', undefined)
    vi.stubEnv('MP_PLATFORM_WEBHOOK_SECRET', undefined)

    const validateEnv = await loadValidateEnv()

    expect(() => validateEnv()).not.toThrow()
  })

  it('accepts the platform variables when both are present', async () => {
    vi.stubEnv('MP_TOKEN_ENCRYPTION_KEY', 'k'.repeat(32))
    vi.stubEnv('MP_PLATFORM_ACCESS_TOKEN', 'platform-access-token')
    vi.stubEnv('MP_PLATFORM_WEBHOOK_SECRET', 'platform-webhook-secret')

    const validateEnv = await loadValidateEnv()

    expect(() => validateEnv()).not.toThrow()
  })
})

// Fase 2: en produccion las credenciales de la plataforma de MercadoPago son
// obligatorias. Sin ellas los handlers de suscripciones no pueden cobrar ni
// validar la firma del webhook, asi que es preferible que la app no arranque.
describe('validateEnv en produccion (MP_PLATFORM_*)', () => {
  const CLOUD_VARS = {
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'token',
    RESEND_API_KEY: 're_token',
    R2_ENDPOINT: 'https://r2.example.com',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET_NAME: 'bucket',
    MERCADOPAGO_WEBHOOK_SECRET: 'tenant-webhook-secret',
    STOREFRONT_URL: 'https://tienda.example.com',
  } as const

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    setRequiredEnvironment()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MP_TOKEN_ENCRYPTION_KEY', 'k'.repeat(32))
    for (const [key, value] of Object.entries(CLOUD_VARS)) {
      vi.stubEnv(key, value)
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('rejects MP_PLATFORM_ACCESS_TOKEN when it is missing', async () => {
    vi.stubEnv('MP_PLATFORM_ACCESS_TOKEN', undefined)
    vi.stubEnv('MP_PLATFORM_WEBHOOK_SECRET', 'platform-webhook-secret')

    const validateEnv = await loadValidateEnv()

    // El mensaje que Zod emite cuando la variable falta es el de tipo
// ("expected string, received undefined"); el mensaje propio de .min(1) solo
// aparece cuando la variable existe pero esta vacia. Por eso se matchea el
// encabezado PRODUCTION mas el nombre de la variable, que es lo unico que
// distingue este fallo de uno del schema de desarrollo.
expect(() => validateEnv()).toThrow(
      /Invalid environment variables for PRODUCTION:[\s\S]*MP_PLATFORM_ACCESS_TOKEN/,
    )
  })

  it('rejects MP_PLATFORM_WEBHOOK_SECRET when it is missing', async () => {
    vi.stubEnv('MP_PLATFORM_ACCESS_TOKEN', 'platform-access-token')
    vi.stubEnv('MP_PLATFORM_WEBHOOK_SECRET', undefined)

    const validateEnv = await loadValidateEnv()

    expect(() => validateEnv()).toThrow(
      /Invalid environment variables for PRODUCTION:[\s\S]*MP_PLATFORM_WEBHOOK_SECRET/,
    )
  })

  it('accepts production when both platform variables are present', async () => {
    vi.stubEnv('MP_PLATFORM_ACCESS_TOKEN', 'platform-access-token')
    vi.stubEnv('MP_PLATFORM_WEBHOOK_SECRET', 'platform-webhook-secret')

    const validateEnv = await loadValidateEnv()

    expect(() => validateEnv()).not.toThrow()
  })
})

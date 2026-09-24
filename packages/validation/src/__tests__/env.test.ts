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

  it('accepts the required key and optional platform variables', async () => {
    vi.stubEnv('MP_TOKEN_ENCRYPTION_KEY', 'k'.repeat(32))
    vi.stubEnv('MP_PLATFORM_ACCESS_TOKEN', 'platform-access-token')
    vi.stubEnv('MP_PLATFORM_WEBHOOK_SECRET', 'platform-webhook-secret')

    const validateEnv = await loadValidateEnv()

    expect(() => validateEnv()).not.toThrow()
  })
})

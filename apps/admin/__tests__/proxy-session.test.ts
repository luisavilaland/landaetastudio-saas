import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'
import { withTenantContext } from '@repo/db'
import { ADMIN_SESSION_COOKIE_NAME } from '@repo/auth/session-cookie'
import { proxy } from '../proxy'

/**
 * El gate, con una cookie de sesion **real**.
 *
 * `proxy.test.ts` mockea `getToken`, asi que fija el contrato de llamada pero no
 * prueba que la sesion se pueda descifrar de verdad: un mock devuelve cualquier
 * cosa que se le pida. Aca se firma un JWE con `encode` de Auth.js usando el
 * mismo `secret` y el mismo `salt` que usa el proxy, y se pasa por la cabecera
 * `cookie` como lo haria el navegador.
 *
 * Si alguien cambia `salt`, `secret` o `cookieName` en un solo lado, `getToken`
 * devuelve `null`, el proxy trata la request como anonima y **deja pasar** al
 * tenant suspendido. El sintoma es un 200 donde este archivo espera un
 * redirect, que es exactamente el tipo de falla silenciosa que S4d tiene que
 * evitar.
 */

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn() }
})

function txReturning(rows: unknown[]) {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  }
  return { select: () => chain }
}

function mockRows(rows: unknown[]) {
  vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
    cb(txReturning(rows) as never),
  )
}

async function signedCookie(tenantId: string): Promise<string> {
  const secret = process.env.AUTH_SECRET

  // Sin `AUTH_SECRET` no se puede firmar nada y el test pasaria por la razon
  // equivocada. En produccion la env se valida al arrancar; aca se afirma.
  if (!secret) throw new Error('AUTH_SECRET is required to sign the test token')

  const token = await encode({
    token: { tenantId },
    secret,
    // El salt del JWE ES el nombre de la cookie (`@auth/core` jwt.js).
    salt: ADMIN_SESSION_COOKIE_NAME,
  })

  return `${ADMIN_SESSION_COOKIE_NAME}=${token}`
}

function requestWithCookie(pathname: string, cookie: string): NextRequest {
  return new NextRequest(`https://admin.landaetastudio.com${pathname}`, {
    headers: { cookie },
  })
}

describe('proxy de admin con cookie real', () => {
  beforeEach(() => {
    vi.mocked(withTenantContext).mockReset()
  })

  it('descifra la sesion y redirige al tenant suspended', async () => {
    mockRows([{ tenantStatus: 'suspended', subscriptionStatus: 'active' }])

    const response = await proxy(
      requestWithCookie('/dashboard', await signedCookie('tenant-1')),
    )

    expect(response.headers.get('location')).toBe(
      'https://admin.landaetastudio.com/suspended',
    )
    expect(withTenantContext).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Function),
    )
  })

  it('descifra la sesion y publica los headers del tenant active', async () => {
    mockRows([{ tenantStatus: 'active', subscriptionStatus: 'active' }])

    const response = await proxy(
      requestWithCookie('/dashboard', await signedCookie('tenant-1')),
    )

    // Control positivo: el 200 con `full` prueba que el token se leyo. Un 200
    // "anonimo" tambien seria 200, pero no traeria headers.
    expect(response.status).toBe(200)
    expect(response.headers.get('x-panel-access')).toBe('full')
  })
})

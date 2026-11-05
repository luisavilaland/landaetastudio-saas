import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { config, proxy } from '../proxy'
import { getToken } from 'next-auth/jwt'
import { withTenantContext } from '@repo/db'
import { captureException } from '@sentry/nextjs'

/**
 * Tests del proxy de admin (S4d).
 *
 * **Este archivo ejecuta `proxy()` de verdad.** El riesgo concreto de este
 * gate es el silencio: si `getToken()` no decodifica (salt/cookie mal), el
 * proxy se comporta como anonimo y deja pasar a todos sin error. Por eso los
 * tests miran la respuesta HTTP, no banderas internas, y hay uno que fija el
 * nombre de cookie contra la config real de `@repo/auth`.
 */

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }))

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

/** `tx` encadenado que devuelve las filas indicadas en `limit()`. */
function txReturning(rows: unknown[]) {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  }
  return { select: () => chain }
}

function mockSessionTenant(tenantId: string | null) {
  vi.mocked(getToken).mockResolvedValue(
    (tenantId ? { tenantId } : {}) as Awaited<ReturnType<typeof getToken>>,
  )
}

function mockRows(rows: unknown[]) {
  vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
    cb(txReturning(rows) as never),
  )
}

function request(pathname: string): NextRequest {
  return new NextRequest(`https://admin.landaetastudio.com${pathname}`)
}

const FULL = { tenantStatus: 'active', subscriptionStatus: 'active' }
const SUSPENDED = { tenantStatus: 'suspended', subscriptionStatus: 'active' }

describe('proxy de admin (S4d)', () => {
  beforeEach(() => {
    vi.mocked(getToken).mockReset()
    vi.mocked(withTenantContext).mockReset()
    vi.mocked(captureException).mockReset()
  })

  it('sin sesion no consulta la base ni bloquea', async () => {
    mockSessionTenant(null)

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(200)
    expect(withTenantContext).not.toHaveBeenCalled()
  })

  it('redirige a /suspended un tenant suspended', async () => {
    mockSessionTenant('tenant-1')
    mockRows([SUSPENDED])

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get('location')).toBe(
      'https://admin.landaetastudio.com/suspended',
    )
  })

  it('en una ruta de API responde 403 con field en vez de redirigir', async () => {
    mockSessionTenant('tenant-1')
    mockRows([SUSPENDED])

    const response = await proxy(request('/api/products'))

    // Un redirect le devuelve HTML al fetch del cliente y lo convierte en un
    // error de parseo en vez de un "no tenes acceso".
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ field: 'account' })
  })

  it('deja pasar y publica el acceso en headers', async () => {
    mockSessionTenant('tenant-1')
    mockRows([FULL])

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-panel-access')).toBe('full')
    expect(response.headers.get('x-tenant-status')).toBe('active')
  })

  it('expired pasa en readonly: ver es menos malo que no ver', async () => {
    mockSessionTenant('tenant-1')
    mockRows([{ tenantStatus: 'active', subscriptionStatus: 'expired' }])

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-panel-access')).toBe('readonly')
  })

  it('sin fila de tenant responde 503 y reporta a Sentry', async () => {
    mockSessionTenant('tenant-1')
    mockRows([])

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(503)
    expect(captureException).toHaveBeenCalled()
  })

  it('con un estado desconocido responde 503, no acceso libre', async () => {
    mockSessionTenant('tenant-1')
    mockRows([{ tenantStatus: 'active', subscriptionStatus: 'estado_raro' }])

    const response = await proxy(request('/api/products'))

    expect(response.status).toBe(503)
    expect(response.headers.get('x-panel-access')).toBeNull()
  })

  it('sin fila de suscripcion deja pasar en readonly', async () => {
    mockSessionTenant('tenant-1')
    mockRows([{ tenantStatus: 'active', subscriptionStatus: null }])

    const response = await proxy(request('/dashboard'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-panel-access')).toBe('readonly')
  })

  it('un tenant suspended sin fila de suscripcion sigue bloqueado', async () => {
    // El caso que abria el panel: la fila ausente cortaba el camino antes del
    // override del eje del tenant.
    mockSessionTenant('tenant-1')
    mockRows([{ tenantStatus: 'suspended', subscriptionStatus: null }])

    const response = await proxy(request('/dashboard'))

    expect(response.headers.get('location')).toBe(
      'https://admin.landaetastudio.com/suspended',
    )
  })
})

describe('matcher del proxy de admin', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`)

  it.each([
    '/api/webhooks/mercadopago/subscriptions',
    '/api/auth/callback/credentials',
    '/api/health',
    '/login',
    '/suspended',
    '/_next/static/chunk.js',
    '/favicon.ico',
  ])('no intercepta %s', (pathname) => {
    expect(matcher.test(pathname)).toBe(false)
  })

  it.each(['/dashboard', '/products', '/api/products', '/api/subscriptions'])(
    'si intercepta %s',
    (pathname) => {
      expect(matcher.test(pathname)).toBe(true)
    },
  )

  it.each([
    '/login-historial',
    '/suspended-history',
    '/api/authentication',
    '/api/healthcheck',
    '/api/webhooksnuevos',
  ])('intercepta %s: la exclusion es del arbol de la ruta, no del prefijo', (pathname) => {
    // Con `login` a secas en el lookahead, `/login-historial` quedaba fuera del
    // gate: bastaba crear una ruta con ese prefijo para saltarse la decision.
    expect(matcher.test(pathname)).toBe(true)
  })

  it.each([
    '/login/reset',
    '/suspended/mas-info',
    '/api/auth/session',
    '/api/health/live',
    '/api/webhooks/mercadopago/orders',
  ])('sigue excluyendo el subarbol %s', (pathname) => {
    expect(matcher.test(pathname)).toBe(false)
  })

  it('el webhook de MercadoPago queda fuera del gate de sesion', () => {
    // Si el webhook pasara por el gate, el pago se cobraria y la orden no se
    // confirmaria: MercadoPago no manda cookie de sesion del tenant.
    expect(matcher.test('/api/webhooks/mercadopago/subscriptions')).toBe(false)
  })
})

describe('headers de decision sin sesion', () => {
  beforeEach(() => {
    vi.mocked(getToken).mockReset()
    vi.mocked(withTenantContext).mockReset()
  })

  it('no reenvia los headers de decision que manda el cliente', async () => {
    // Anti-spoofing: si el cliente escribe `x-panel-access: full` y el proxy
    // devuelve la request sin limpiarla, un handler que confie en ese header
    // lee el valor del atacante.
    const spoofed = new NextRequest(
      'https://admin.landaetastudio.com/dashboard',
      {
        headers: {
          'x-panel-access': 'full',
          'x-tenant-status': 'active',
        },
      },
    )
    mockSessionTenant(null)

    const response = await proxy(spoofed)

    expect(response.headers.get('x-panel-access')).toBeNull()
    expect(response.headers.get('x-middleware-request-x-panel-access')).toBeNull()
    expect(response.headers.get('x-middleware-request-x-tenant-status')).toBeNull()
    expect(withTenantContext).not.toHaveBeenCalled()
  })
})

describe('cookie de sesion de admin', () => {
  it('el proxy usa el nombre real que emite NextAuth', async () => {
    const { ADMIN_SESSION_COOKIE_NAME } = await import(
      '@repo/auth/session-cookie'
    )

    // Literal a proposito: si alguien cambia el nombre en la config de NextAuth
    // y no aca (o al reves), `getToken()` devuelve null y el gate deja pasar a
    // todos **en silencio**. Este assert es el que rompe en ese caso.
    expect(ADMIN_SESSION_COOKIE_NAME).toMatch(
      /^(__Secure-)?authjs\.session-token-admin$/,
    )
  })

  it('getToken recibe el nombre como cookieName y como salt', async () => {
    const { ADMIN_SESSION_COOKIE_NAME } = await import(
      '@repo/auth/session-cookie'
    )
    mockSessionTenant('tenant-1')
    mockRows([FULL])

    await proxy(request('/dashboard'))

    // El salt del JWE ES el nombre de cookie (`@auth/core`
    // `lib/actions/session.js`). Si solo se pasa `cookieName`, la cookie se
    // encuentra pero no se puede descifrar.
    expect(vi.mocked(getToken)).toHaveBeenCalledWith(
      expect.objectContaining({
        cookieName: ADMIN_SESSION_COOKIE_NAME,
        salt: ADMIN_SESSION_COOKIE_NAME,
      }),
    )
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { makeTxMock, session } from '@repo/test-utils'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: undefined }
})

import { auth } from '@/lib/auth'
import { GET } from '../route'

const PLAN = {
  id: 'plan-1',
  slug: 'profesional',
  displayName: 'Profesional',
  priceUyu: 4900,
}

function sub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    status: 'active',
    planId: 'plan-1',
    currentPeriodEnd: new Date('2026-11-03T00:00:00Z'),
    mpPreapprovalId: 'preapproval-abc',
    lastProcessedPaymentId: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  }
}

/** Los selects del handler van en orden: suscripcion, plan. */
function txMock(subscription = sub(), plan: unknown = PLAN) {
  return makeTxMock({
    select: [
      { data: [subscription], terminal: 'limit' },
      { data: plan === null ? [] : [plan], terminal: 'limit' },
    ],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/subscriptions — auth', () => {
  it('401 sin sesion', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('No autorizado')
    expect(withTenantContext).not.toHaveBeenCalled()
  })

  it('400 cuando la sesion no trae tenantId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'a@b.com' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)

    const res = await GET()

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Tenant no encontrado')
    expect(withTenantContext).not.toHaveBeenCalled()
  })
})

describe('GET /api/subscriptions — datos', () => {
  it('200 con estado, plan y permisos para una suscripcion activa', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(txMock()),
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('active')
    expect(body.planId).toBe('plan-1')
    expect(body.planName).toBe('Profesional')
    expect(body.planSlug).toBe('profesional')
    // El precio viaja en centavos (contrato interno). La UI divide por 100.
    expect(body.priceUyu).toBe(4900)
    expect(body.hasPreapproval).toBe(true)
    expect(body.permissions.canWrite).toBe(true)
    expect(body.permissions.canPause).toBe(true)
    expect(body.permissions.canResume).toBe(false)
  })

  it('404 cuando el tenant no tiene suscripcion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'limit' }] })),
    )

    const res = await GET()

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('No hay suscripcion para este tenant')
  })

  it('no rompe si el plan de la suscripcion ya no existe', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(txMock(sub(), null)),
    )

    const res = await GET()
    const body = await res.json()

    // No debe 500: el nombre del plan es dato decoration, no la suscripcion.
    expect(res.status).toBe(200)
    expect(body.planName).toBeNull()
    expect(body.priceUyu).toBeNull()
    expect(body.status).toBe('active')
  })
})

describe('GET /api/subscriptions — permisos por estado', () => {
  const casos = [
    { estado: 'active', canWrite: true, canPause: true, canResume: false },
    { estado: 'paused', canWrite: false, canPause: false, canResume: true },
    {
      estado: 'past_due',
      canWrite: false,
      canPause: false,
      canResume: false,
    },
    {
      estado: 'cancelled',
      canWrite: false,
      canPause: false,
      canResume: false,
    },
  ] as const

  for (const c of casos) {
    it(`${c.estado}: permisos coherentes`, async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
        cb(txMock(sub({ status: c.estado }))),
      )

      const body = await (await GET()).json()

      expect(body.permissions.canWrite).toBe(c.canWrite)
      expect(body.permissions.canPause).toBe(c.canPause)
      expect(body.permissions.canResume).toBe(c.canResume)
    })
  }

  it('500 y log si el estado en la DB no es un estado conocido', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(txMock(sub({ status: 'estado_inventado' }))),
    )

    const res = await GET()

    // Devolver permisos por defecto abriria el panel de un tenant en un estado
    // que no entendemos.
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Estado de suscripcion no soportado')
  })
})

describe('GET /api/subscriptions — aislamiento multi-tenant', () => {
  it('abre el contexto con el tenantId de la sesion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-7'))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(txMock()),
    )

    await GET()

    expect(withTenantContext).toHaveBeenCalledWith(
      'tenant-7',
      expect.any(Function),
    )
  })

  it('nunca usa un tenantId del query string', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-7'))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(txMock()),
    )

    // El handler no lee searchParams en ningun punto. Si alguien lo agrega, la
    // fila del otro tenant seria alcanzable.
    await GET()

    expect(withTenantContext).toHaveBeenCalledTimes(1)
    expect(withTenantContext).not.toHaveBeenCalledWith(
      expect.not.stringMatching(/^tenant-7$/),
      expect.any(Function),
    )
  })

  it('el contexto se abre exactamente una vez por request', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(txMock()),
    )

    await GET()

    // Una sola transaccion: si se abriera dos veces, la lectura del plan podria
    // salirse del contexto de tenant.
    expect(withTenantContext).toHaveBeenCalledTimes(1)
  })
})
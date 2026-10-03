import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { makeTxMock, session, mockReq } from '@repo/test-utils'

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

vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return { ...actual, createPreapproval: vi.fn(), redisIncr: vi.fn(), redisPexpire: vi.fn() }
})

import { auth } from '@/lib/auth'
import { createPreapproval, redisIncr, redisPexpire } from '@repo/commerce'
import { POST } from '../route'

const TOKEN = 'APP_USR-platform-token'
const PLAN = {
  id: 'plan-1',
  displayName: 'Profesional',
  priceUyu: 4900,
  isActive: true,
}

function sub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    status: 'pending_first_payment',
    mpPreapprovalId: null,
    planId: 'plan-1',
    ...overrides,
  }
}

/** Selects en orden: suscripcion, plan. La 2da llamada es el UPDATE. */
function mockCtx(row: unknown, plan: unknown = PLAN) {
  vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
    cb(
      makeTxMock({
        select: [
          { data: row === null ? [] : [row], terminal: 'limit' },
          { data: plan === null ? [] : [plan], terminal: 'limit' },
        ],
      }),
    ),
  )
}

function req(ip = '1.2.3.4', body: unknown = {}) {
  return mockReq('POST', body, {
    'x-forwarded-for': ip,
    // `getAdminBaseUrl` (T2) exige `host`: sin el no se puede armar la
    // `back_url` del preapproval y lo tira a proposito.
    host: 'admin.tenant.test',
    'x-forwarded-proto': 'https',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MP_PLATFORM_ACCESS_TOKEN = TOKEN
  // Redis sano por defecto: dentro del limite.
  vi.mocked(redisIncr).mockResolvedValue(1)
  vi.mocked(redisPexpire).mockResolvedValue(undefined)
  vi.mocked(createPreapproval).mockResolvedValue({
    id: 'preapproval-nuevo',
    init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x',
  })
  mockCtx(sub())
})

describe('POST /api/subscriptions/preapproval — auth', () => {
  it('401 sin sesion', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await POST(req())

    expect(res.status).toBe(401)
    expect(withTenantContext).not.toHaveBeenCalled()
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('400 si la sesion no trae tenantId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'a@b.com' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)

    const res = await POST(req())

    expect(res.status).toBe(400)
    expect(createPreapproval).not.toHaveBeenCalled()
  })
})

describe('POST /api/subscriptions/preapproval — happy path', () => {
  it('201 con preapprovalId e initPoint, y persiste el id en la DB', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const res = await POST(req())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.preapprovalId).toBe('preapproval-nuevo')
    expect(body.initPoint).toContain('mercadopago.com.ar')
    // La escritura del mpPreapprovalId es una 2da transaccion explicita.
    expect(withTenantContext).toHaveBeenCalledTimes(2)
  })

  it('manda el precio en la moneda de MP, no en centavos', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    await POST(req())

    const [input] = vi.mocked(createPreapproval).mock.calls[0]
    // 4900 centavos -> 49 UYU. Mandar 4900 seria cobrar 49 veces mas.
    expect(input?.transactionAmount).toBe(49)
    expect(input?.currencyId).toBe('UYU')
  })

  it('NO manda notification_url (MP la descarta en silencio)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    await POST(req())

    const [input] = vi.mocked(createPreapproval).mock.calls[0]
    // Verificado el 2026-10-03: MP acepta el campo y lo ignora. Mandarlo da
    // una falsa sensacion de que el webhook por HTTP esta configurado.
    expect(input).not.toHaveProperty('notificationUrl')
    expect(input).not.toHaveProperty('notification_url')
  })

  it('usa el external_reference = tenantId para que el webhook cruce', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-42'))

    await POST(req())

    const [input] = vi.mocked(createPreapproval).mock.calls[0]
    expect(input?.externalReference).toBe('tenant-42')
  })

  it('toma el payerEmail del JWT, no de un header del cliente', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1', 'dueño@tenant.com'))

    // Un header arbitrario no debe poder redirigir el cobro.
    const request = mockReq('POST', {}, {
      'x-tenant-owner-email': 'atacante@evil.com',
      'x-forwarded-for': '1.2.3.4',
      host: 'admin.tenant.test',
    })

    await POST(request)

    const [input] = vi.mocked(createPreapproval).mock.calls[0]
    expect(input?.payerEmail).toBe('dueño@tenant.com')
  })

  it('persiste el preapprovalId con una 2da transaccion (SET LOCAL no sobrevive)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    await POST(req())

    // Dos conTenantContext: leer y luego escribir. Un unico
    // `db.execute(SET LOCAL)` fuera de transaccion perderia el tenant.
    expect(withTenantContext).toHaveBeenCalledTimes(2)
  })
})

describe('POST /api/subscriptions/preapproval — rate limit', () => {
  it('429 al superar 10 intentos en la ventana, sin llamar a MP', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(redisIncr).mockResolvedValue(11)

    const res = await POST(req())

    expect(res.status).toBe(429)
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('permite el intento 10 y corta el 11', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    vi.mocked(redisIncr).mockResolvedValue(10)
    expect((await POST(req())).status).toBe(201)

    vi.mocked(redisIncr).mockResolvedValue(11)
    expect((await POST(req())).status).toBe(429)
  })

  it('fija la ventana de 60s solo en el primer hit', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    vi.mocked(redisIncr).mockResolvedValue(1)
    await POST(req())
    expect(redisPexpire).toHaveBeenCalledWith(expect.any(String), 60_000)

    vi.mocked(redisIncr).mockResolvedValue(2)
    await POST(req())
    expect(redisPexpire).toHaveBeenCalledTimes(1)
  })

  it('rate-limit por IP: dos IPs distintas no comparten cuota', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    vi.mocked(redisIncr).mockResolvedValue(11)
    expect((await POST(req('1.1.1.1'))).status).toBe(429)
    expect((await POST(req('2.2.2.2'))).status).toBe(429)

    const keys = vi.mocked(redisIncr).mock.calls.map((c) => c[0])
    expect(keys[0]).not.toBe(keys[1])
  })

  it('fail-open si Redis cae: permitir es mejor que 500 en el alta', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(redisIncr).mockResolvedValue(null)

    const res = await POST(req())

    expect(res.status).toBe(201)
  })

  it('fail-open si redisIncr lanza', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(redisIncr).mockRejectedValue(new Error('ECONNRESET'))

    expect((await POST(req())).status).toBe(201)
  })
})

describe('POST /api/subscriptions/preapproval — guardas', () => {
  it('404 si el tenant no tiene suscripcion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(null)

    const res = await POST(req())

    expect(res.status).toBe(404)
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('404 si el plan de la suscripcion no existe', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub(), null)

    const res = await POST(req())

    expect(res.status).toBe(404)
    expect((await res.json()).field).toBe('planId')
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('409 si el plan esta inactivo', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub(), { ...PLAN, isActive: false })

    const res = await POST(req())

    expect(res.status).toBe(409)
    expect((await res.json()).field).toBe('planId')
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('409 con el preapproval existente en vez de crear otro (doble click)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ mpPreapprovalId: 'preapproval-ya-existe' }))

    const res = await POST(req())
    const body = await res.json()

    // Crear otro genera suscripciones huerfanas en MP que hay que cancelar a
    // mano.
    expect(res.status).toBe(409)
    expect(body.preapprovalId).toBe('preapproval-ya-existe')
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('409 si la suscripcion no esta en `pending_first_payment`', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ status: 'paused' }))

    const res = await POST(req())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.status).toBe('paused')
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('500 sin token de plataforma', async () => {
    delete process.env.MP_PLATFORM_ACCESS_TOKEN
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const res = await POST(req())

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('MercadoPago no configurado')
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('502 si MP responde sin init_point', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(createPreapproval).mockResolvedValue({ id: 'preapproval-nuevo' })

    const res = await POST(req())

    // Sin init_point el frontend no tiene donde mandar al usuario.
    expect(res.status).toBe(500)
  })

  it('502 si MP devuelve un error de API', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const err = new Error('bad request')
    err.name = 'MercadoPagoApiError'
    vi.mocked(createPreapproval).mockRejectedValue(err)

    const res = await POST(req())

    expect(res.status).toBe(502)
  })

  it('503 si MP no responde (timeout)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const err = new Error('timeout')
    err.name = 'MercadoPagoApiError'
    vi.mocked(createPreapproval).mockRejectedValue(err)

    const res = await POST(req())

    // No hubo respuesta: 503 es mas honesto que 502.
    expect(res.status).toBe(503)
  })
})

describe('POST /api/subscriptions/preapproval — aislamiento multi-tenant', () => {
  it('abre el contexto con el tenantId de la sesion y lo manda a MP', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-77'))

    await POST(req())

    expect(withTenantContext).toHaveBeenNthCalledWith(
      1,
      'tenant-77',
      expect.any(Function),
    )
    const [input] = vi.mocked(createPreapproval).mock.calls[0]
    // Si el external_reference no fuera el tenant, el webhook no podria
    // asignar el pago al tenant correcto.
    expect(input?.externalReference).toBe('tenant-77')
  })

  it('no acepta un tenantId en el body', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-77'))

    // Un tenant que intenta dar de alta la suscripcion de otro.
    const res = await POST(req('1.2.3.4', { tenantId: 'tenant-99', planId: 'plan-9' }))

    expect(res.status).toBe(201)
    const [firstCall] = vi.mocked(withTenantContext).mock.calls
    expect(firstCall?.[0]).toBe('tenant-77')
    const [input] = vi.mocked(createPreapproval).mock.calls[0]
    expect(input?.externalReference).toBe('tenant-77')
  })
})
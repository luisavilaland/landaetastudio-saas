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
  return { ...actual, updatePreapproval: vi.fn(), getPreapproval: vi.fn() }
})

import { auth } from '@/lib/auth'
import { updatePreapproval, getPreapproval } from '@repo/commerce'
import { PUT } from '../route'

const TOKEN = 'APP_USR-platform-token'
const PLAN_PRO = { id: 'plan-pro', slug: 'pro', displayName: 'Pro', priceUyu: 9000, isActive: true }
const PLAN_BASICO = { id: 'plan-basico', slug: 'basico', displayName: 'Basico', priceUyu: 3000, isActive: true }

const PLAN_ID = '11111111-1111-4111-8111-111111111111'

/** Periodo con 30 dias completos: prorrateo exacto y sin decimales. */
const PERIOD_END = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

function sub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    status: 'active',
    planId: PLAN_BASICO.id,
    currentPeriodEnd: PERIOD_END,
    mpPreapprovalId: 'preapproval-abc',
    ...overrides,
  }
}

/**
 * Selects en orden: suscripcion, plan destino, plan actual.
 *
 * Devuelve el tx para que los tests puedan afirmar sobre `tx.set`, que es donde
 * queda registrada la escritura de `planId` (H3).
 */
function mockCtx(row: unknown, nuevo = PLAN_PRO, actual = PLAN_BASICO) {
  const tx = makeTxMock({
    select: [
      { data: row === null ? [] : [row], terminal: 'limit' },
      { data: nuevo === null ? [] : [nuevo], terminal: 'limit' },
      { data: actual === null ? [] : [actual], terminal: 'limit' },
    ],
  })
  vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
  return tx
}

function put(body: unknown = { planId: PLAN_ID }) {
  return mockReq('PUT', body)
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MP_PLATFORM_ACCESS_TOKEN = TOKEN
  vi.mocked(updatePreapproval).mockResolvedValue({ id: 'preapproval-abc' })
  vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 90 })
  mockCtx(sub())
})

describe('PUT /api/subscriptions/plan — auth y validacion', () => {
  it('401 sin sesion', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await PUT(put())

    expect(res.status).toBe(401)
    expect(withTenantContext).not.toHaveBeenCalled()
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('400 si la sesion no trae tenantId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'a@b.com' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as never)

    expect((await PUT(put())).status).toBe(400)
  })

  it('400 con `field` si el planId no es un UUID', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const res = await PUT(put({ planId: 'no-soy-uuid' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.field).toBe('planId')
    expect(withTenantContext).not.toHaveBeenCalled()
  })

  it('400 si falta planId', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const res = await PUT(put({}))

    expect(res.status).toBe(400)
    expect((await res.json()).field).toBe('planId')
  })

  it('400 si el body no es JSON', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const res = await PUT(mockReq('PUT', undefined as never))

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/subscriptions/plan — guardas', () => {
  it('404 si el tenant no tiene suscripcion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(null)

    const res = await PUT(put())

    expect(res.status).toBe(404)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('404 si el plan destino no existe', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub(), null)

    const res = await PUT(put())

    expect(res.status).toBe(404)
    expect((await res.json()).field).toBe('planId')
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('409 si el plan destino esta inactivo', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub(), { ...PLAN_PRO, isActive: false })

    const res = await PUT(put())

    expect(res.status).toBe(409)
    expect((await res.json()).field).toBe('planId')
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('409 si ya tiene ese plan', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ planId: PLAN_PRO.id }))

    const res = await PUT(put())

    expect(res.status).toBe(409)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('409 si la suscripcion no esta activa (paused)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ status: 'paused' }))

    const res = await PUT(put())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.status).toBe('paused')
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('409 si la suscripcion no tiene preapproval en MP', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ mpPreapprovalId: null }))

    const res = await PUT(put())

    expect(res.status).toBe(409)
    expect((await res.json()).field).toBe('preapproval')
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('409 si el periodo ya vencio: no hay prorrateo posible', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ currentPeriodEnd: new Date(Date.now() - 86_400_000) }))

    const res = await PUT(put())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.field).toBe('currentPeriodEnd')
    expect(updatePreapproval).not.toHaveBeenCalled()
  })
})

describe('PUT /api/subscriptions/plan — upgrade (402)', () => {
  it('402 con el monto a cobrar, sin tocar MP', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    // Actual 3000 centavos, nuevo 9000, ~15/30 del periodo => 3000 a cobrar.
    mockCtx(sub())

    const res = await PUT(put())
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.code).toBe('upgrade_requires_payment')
    expect(body.direction).toBe('upgrade')
    expect(body.currency).toBe('UYU')
    expect(body.proratedAmountCents).toBeGreaterThan(0)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('el monto a cobrar es la diferencia por el tiempo restante', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const mitadDelPeriodo = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    mockCtx(sub({ currentPeriodEnd: mitadDelPeriodo }))

    const body = await (await PUT(put())).json()

    // 6000 de diferencia * 15/30 = 3000 centavos.
    expect(body.daysRemaining).toBe(15)
    expect(body.proratedAmountCents).toBe(3000)
  })

  it('casi fin de periodo: el importe a cobrar tiende a 0', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000) }))

    const body = await (await PUT(put())).json()

    // 6000 * 1/30 = 200 centavos, no 6000.
    expect(body.daysRemaining).toBe(1)
    expect(body.proratedAmountCents).toBe(200)
  })

  it('sin `currentPeriodEnd` no bloquea: cobra el precio completo', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ currentPeriodEnd: null }))

    const res = await PUT(put())

    // No hay dato para prorratear, pero eso no puede dejar al tenant sin poder
    // cambiar de plan.
    expect(res.status).toBe(202)
    expect(updatePreapproval).toHaveBeenCalled()
  })
})

describe('PUT /api/subscriptions/plan — downgrade (202)', () => {
  beforeEach(() => {
    // Downgrade: de Pro (9000) a Basico (3000). MP refleja 30.
    mockCtx(sub({ planId: PLAN_PRO.id }), PLAN_BASICO, PLAN_PRO)
    vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 30 })
  })

  it('202 con el credito a favor y actualiza el monto en MP', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const res = await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.direction).toBe('downgrade')
    // Positivo = credito (se aplica en la proxima facturacion).
    expect(body.creditCents).toBeGreaterThan(0)
  })

  it('manda el monto en la moneda de MP, no en centavos', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))

    const [, patch] = vi.mocked(updatePreapproval).mock.calls[0]
    // 3000 centavos -> 30 UYU.
    expect(patch?.transactionAmount).toBe(30)
  })

  it('NO manda `auto_recurring`: el wrapper de T3 ya lo envuelve', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))

    const [, patch] = vi.mocked(updatePreapproval).mock.calls[0]
    expect(patch).not.toHaveProperty('auto_recurring')
    expect(patch).not.toHaveProperty('status')
  })
})

describe('PUT /api/subscriptions/plan — escritura de planId (H3)', () => {
  /**
   * Downgrade Pro (9000) -> Basico (3000), que es el unico camino que llega al
   * 202: un upgrade corta antes en el 402 con el monto a cobrar.
   */
  const DOWNGRADE_BODY = { planId: '22222222-2222-4222-8222-222222222222' }

  function downgradeCtx() {
    return mockCtx(sub({ planId: PLAN_PRO.id }), PLAN_BASICO, PLAN_PRO)
  }

  it('escribe planId despues de que MP confirme el monto', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const tx = downgradeCtx()
    // MP quedo con el monto nuevo: 3000 centavos -> 30 en la moneda de MP.
    vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 30 })

    const res = await PUT(put(DOWNGRADE_BODY))

    expect(res.status).toBe(202)
    // H3: antes de este PR la DB seguia reportando el plan de creacion.
    expect(tx.set).toHaveBeenCalledWith({
      planId: PLAN_BASICO.id,
      updatedAt: expect.any(Date),
    })
  })

  it('NO escribe planId si el monto que quedo en MP no es el esperado', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const tx = downgradeCtx()
    // MP acepto el PUT pero el monto sigue siendo el viejo.
    vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 90 })

    const res = await PUT(put(DOWNGRADE_BODY))

    expect(res.status).toBe(502)
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('NO escribe planId si la verificacion no pudo confirmar el monto', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const tx = downgradeCtx()
    vi.mocked(getPreapproval).mockRejectedValue(new Error('timeout'))

    const res = await PUT(put(DOWNGRADE_BODY))

    // El 202 sigue siendo valido (el PUT a MP si salio, ver el test de arriba),
    // pero sin confirmacion no se afirma nada en la DB: escribir planId seria
    // registrar un estado que nadie verifico.
    expect(res.status).toBe(202)
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('el 409 "ya tenes ese plan" ahora refleja la DB real', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    // La suscripcion ya esta en Basico (escribido por el 202 de un cambio
    // anterior). Pedir Basico de nuevo es un conflicto real, no un falso 409
    // contra el plan de creacion.
    mockCtx(sub({ planId: PLAN_BASICO.id }), PLAN_BASICO, PLAN_BASICO)

    const res = await PUT(put({ planId: '33333333-3333-4333-8333-333333333333' }))

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      error: 'Ya tenes ese plan',
      field: 'planId',
    })
  })
})

describe('PUT /api/subscriptions/plan — verificacion post-escritura', () => {
  it('502 si MP acepta el PUT pero el monto no quedo aplicado', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ planId: PLAN_PRO.id }), PLAN_BASICO, PLAN_PRO)
    // MP responde bien pero el monto sigue siendo el viejo.
    vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 90 })

    const res = await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))

    // Sin esto, un 202 falso: el tenant cree que pago menos y sigue pagando mas.
    expect(res.status).toBe(502)
  })

  it('202 si el GET de verificacion falla: el PUT ya salio bien', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ planId: PLAN_PRO.id }), PLAN_BASICO, PLAN_PRO)
    vi.mocked(getPreapproval).mockRejectedValue(new Error('timeout'))

    const res = await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))

    expect(res.status).toBe(202)
  })

  it('202 si MP no devuelve transaction_amount en la verificacion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ planId: PLAN_PRO.id }), PLAN_BASICO, PLAN_PRO)
    vi.mocked(getPreapproval).mockResolvedValue({})

    const res = await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))

    // Campo ausente != monto incorrecto: no se puede afirmar que fallo.
    expect(res.status).toBe(202)
  })

  it('502 si MP rechaza el cambio', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    // Downgrade: sin esto el caso caeria en el 402 del upgrade y nunca llegaria
    // a llamar a MP.
    mockCtx(sub({ planId: PLAN_PRO.id }), PLAN_BASICO, PLAN_PRO)
    const err = new Error('invalid transition')
    err.name = 'MercadoPagoApiError'
    vi.mocked(updatePreapproval).mockRejectedValue(err)

    const res = await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))

    expect(res.status).toBe(502)
  })

  it('503 si MP no responde (timeout)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ planId: PLAN_PRO.id }), PLAN_BASICO, PLAN_PRO)
    const err = new Error('timeout')
    err.name = 'MercadoPagoApiError'
    vi.mocked(updatePreapproval).mockRejectedValue(err)

    const res = await PUT(put({ planId: '22222222-2222-4222-8222-222222222222' }))

    expect(res.status).toBe(503)
  })

  it('500 sin token de plataforma', async () => {
    delete process.env.MP_PLATFORM_ACCESS_TOKEN
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const res = await PUT(put())

    expect(res.status).toBe(500)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })
})

describe('PUT /api/subscriptions/plan — aislamiento multi-tenant', () => {
  it('abre el contexto con el tenantId de la sesion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-88'))

    await PUT(put())

    expect(withTenantContext).toHaveBeenCalledWith('tenant-88', expect.any(Function))
  })

  it('no acepta un tenantId en el body', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-88'))

    await PUT(put({ planId: PLAN_ID, tenantId: 'tenant-99' }))

    expect(vi.mocked(withTenantContext).mock.calls[0]?.[0]).toBe('tenant-88')
  })

  it('una sola transaccion de lectura', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-88'))

    await PUT(put())

    expect(withTenantContext).toHaveBeenCalledTimes(1)
  })
})
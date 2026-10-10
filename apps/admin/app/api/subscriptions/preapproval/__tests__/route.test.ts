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
  return {
    ...actual,
    createPreapproval: vi.fn(),
    getPreapproval: vi.fn(),
    redisDel: vi.fn(),
    redisIncr: vi.fn(),
    redisPexpire: vi.fn(),
  }
})

import { auth } from '@/lib/auth'
import {
  createPreapproval,
  getPreapproval,
  redisDel,
  redisIncr,
  redisPexpire,
} from '@repo/commerce'
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

/** Estado compartido del slot que ocupa la reserva. */
interface ReservationSlot {
  /** Valor que la DB tiene ahora en `mpPreapprovalId`. */
  holder: string | null
  /** Reserva creada por ESTE flujo. El cierre solo escribe si sigue siendo la dueña. */
  mine: string | null
}

/**
 * Tx que simula la reserva como un compare-and-set real sobre un slot
 * compartido, en vez de un `returning` fijo.
 *
 * Item 69: el punto del fix es que la escritura de la reserva sea condicional.
 * Un mock que devuelve `[{ id }]` siempre no probaria nada — pasaria con y sin
 * el fix. Este lo hace fallar cuando el slot ya esta tomado, que es exactamente
 * lo que hace PostgreSQL con `WHERE mpPreapprovalId IS NULL`.
 */
function reservationTx(
  row: unknown,
  plan: unknown,
  slot: ReservationSlot,
) {
  const tx = makeTxMock({
    select: [
      { data: row === null ? [] : [row], terminal: 'limit' },
      { data: plan === null ? [] : [plan], terminal: 'limit' },
    ],
  })

  let written: unknown
  tx.set.mockImplementation((values: Record<string, unknown>) => {
    written = values.mpPreapprovalId
    return tx
  })
  tx.returning.mockImplementation(async () => {
    const value = written as string
    if (typeof value !== 'string') return [{ id: 'sub-1' }]

    // Reserva (`pending:<id>`): solo gana si el slot esta libre.
    if (value.startsWith('pending:')) {
      if (slot.holder !== null) return []
      slot.holder = value
      slot.mine = value
      return [{ id: 'sub-1' }]
    }

    // Cierre (id real de MP): solo escribe si la fila sigue teniendo NUESTRA
    // reserva. Si otro proceso reservo o ya escribio su id, no puede.
    if (slot.holder !== null && slot.holder === slot.mine) {
      slot.holder = `closed:${slot.mine}`
      return [{ id: 'sub-1' }]
    }
    return []
  })

  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MP_PLATFORM_ACCESS_TOKEN = TOKEN
  // Redis sano por defecto: dentro del limite.
  vi.mocked(redisIncr).mockResolvedValue(1)
  // Item 66 (H-F2-7): `redisPexpire` ahora devuelve `boolean`. Este mock decia
  // `undefined`, que era el contrato viejo (void) — y como `vi.fn()` no esta
  // tipado, `tsc` nunca lo detecto. Con `undefined` el call site tomaba el
  // camino de falla y borraba la clave en cada request.
  vi.mocked(redisPexpire).mockResolvedValue(true)
  vi.mocked(redisDel).mockResolvedValue(undefined)
  vi.mocked(createPreapproval).mockResolvedValue({
    id: 'preapproval-nuevo',
    init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x',
  })
  // Item 68 (H-F2-6): la verificacion post-escritura exige que MP confirme el
  // monto. Sin este default `verifiedAmount` queda `null` y TODOS los tests que
  // esperan 201 recibirian 502. El fixture cobra 4900 centavos, que en la moneda
  // de MP son 49 (`toMpAmount`).
  vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 49 })
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
    // Item 69: tres conTenantContext, no dos — leer, reservar y cerrar. Cada
    // escritura va en su propia transaccion.
    expect(withTenantContext).toHaveBeenCalledTimes(3)
  })

  it('manda el precio en la moneda de MP, no en centavos', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    await POST(req())

    const [input] = vi.mocked(createPreapproval).mock.calls[0]
    // 4900 centavos -> 49 UYU. Mandar 4900 seria cobrar 49 veces mas.
    expect(input?.transactionAmount).toBe(49)
    expect(input?.currencyId).toBe('UYU')
  })

  // Item 68 (H-F2-6). El caso del monto ya cubierto arriba ("manda el precio en
  // la moneda de MP") asserta el ARGUMENTO enviado; estos assertan lo que MP
  // devolvio, que es lo unico que prueba que el cobro va a ser el correcto.
  describe('verificacion post-escritura del monto', () => {
    /** Tx con el slot de la reserva, para poder observar las escrituras. */
    function ctxWithTx() {
      const slot: ReservationSlot = { holder: null, mine: null }
      const tx = reservationTx(sub(), PLAN, slot)
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
      return tx
    }

    it('201 con initPoint cuando MP confirma el monto', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 49 })

      const res = await POST(req())
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.initPoint).toContain('mercadopago.com.ar')
      // La llamada es el punto del fix: sin ella el monto nunca se compara.
      expect(getPreapproval).toHaveBeenCalledWith('preapproval-nuevo', TOKEN)
    })

    it('502 sin initPoint si MP acepto pero el monto no coincide', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      const tx = ctxWithTx()
      // MP quedo con 4900 en vez de 49: el tenant pagaria 100 veces mas.
      vi.mocked(getPreapproval).mockResolvedValue({ transaction_amount: 4900 })

      const res = await POST(req())
      const body = await res.json()

      expect(res.status).toBe(502)
      expect(body).not.toHaveProperty('initPoint')
      expect(body.field).toBe('transactionAmount')
      // El id real de MP no puede quedar escrito: se afirmaria un estado que
      // nadie confirmo.
      expect(tx.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ mpPreapprovalId: 'preapproval-nuevo' }),
      )
    })

    it('502 sin initPoint si el GET de verificacion falla', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      const tx = ctxWithTx()
      vi.mocked(getPreapproval).mockRejectedValue(new Error('timeout'))

      const res = await POST(req())
      const body = await res.json()

      // DIVERGE de `/plan` a proposito: alla el PUT ya habia salido y un 502
      // diria "tu cambio fallo" cuando si salio. Aca no se entrego nada todavia
      // y el tenant no pago, asi que no hay nada que affirmar ni nada que
      // entregar.
      expect(res.status).toBe(502)
      expect(body).not.toHaveProperty('initPoint')
      expect(tx.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ mpPreapprovalId: 'preapproval-nuevo' }),
      )
    })

    it('502 si MP no devuelve transaction_amount', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      const tx = ctxWithTx()
      vi.mocked(getPreapproval).mockResolvedValue({})

      const res = await POST(req())

      // Campo ausente != monto incorrecto, pero tampoco es confirmacion: sin
      // monto verificado no se entrega el punto de pago.
      expect(res.status).toBe(502)
      expect(tx.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ mpPreapprovalId: 'preapproval-nuevo' }),
      )
    })
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

  it('persiste el preapprovalId con su propia transaccion (SET LOCAL no sobrevive)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    await POST(req())

    // Tres conTenantContext: leer, reservar y cerrar. Un unico
    // `db.execute(SET LOCAL)` fuera de transaccion perderia el tenant. Son tres
    // y no uno justamente porque la llamada a MP ocurre en el medio: cada
    // escritura necesita su propio contexto de tenant.
    expect(withTenantContext).toHaveBeenCalledTimes(3)
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

  // Item 66 (H-F2-7). El bug no era que el TTL fallara: era que no se podia
  // saber si fallaba, y la clave quedaba sin vencimiento.
  describe('TTL del rate limit (item 66)', () => {
    it('si el TTL se aplico, NO borra la clave', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      vi.mocked(redisIncr).mockResolvedValue(1)
      vi.mocked(redisPexpire).mockResolvedValue(true)

      await POST(req())

      expect(redisPexpire).toHaveBeenCalledWith(expect.any(String), 60_000)
      expect(redisDel).not.toHaveBeenCalled()
    })

    it('si el TTL fallo, deja pasar el request (fail-open)', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      vi.mocked(redisIncr).mockResolvedValue(1)
      vi.mocked(redisPexpire).mockResolvedValue(false)

      const res = await POST(req())

      // Fail-open: el rate limit es proteccion, no funcionalidad critica.
      expect(res.status).toBe(201)
    })

    it('si el TTL fallo, borra la clave para que el proximo request reintente', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      vi.mocked(redisIncr).mockResolvedValue(1)
      vi.mocked(redisPexpire).mockResolvedValue(false)

      await POST(req())

      // ESTE es el punto del fix. Sin el borrado, la clave queda sin TTL para
      // siempre: `count === 1` no se repite, nadie reintenta, el contador sube
      // y el 429 es permanente. Log + fail-open solo hacia visible el bug.
      expect(redisDel).toHaveBeenCalledWith(expect.any(String))
      // La misma clave que se iba a expirar, no una cualquiera.
      const pexpiredKey = vi.mocked(redisPexpire).mock.calls[0][0]
      expect(redisDel).toHaveBeenCalledWith(pexpiredKey)
    })

    it('si Redis no responde al INCR, fail-open sin tocar el TTL', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      vi.mocked(redisIncr).mockResolvedValue(null)

      const res = await POST(req())

      expect(res.status).toBe(201)
      expect(redisPexpire).not.toHaveBeenCalled()
      expect(redisDel).not.toHaveBeenCalled()
    })
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
    vi.mocked(getPreapproval).mockResolvedValue({
      id: 'preapproval-ya-existe',
      init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref=ya-existe',
    })

    const res = await POST(req())
    const body = await res.json()

    // Crear otro genera suscripciones huerfanas en MP que hay que cancelar a
    // mano.
    expect(res.status).toBe(409)
    expect(body.preapprovalId).toBe('preapproval-ya-existe')
    // Item 65 (H-F2-3): el 409 tambien trae `initPoint`. Sin el, la UI puede
    // mostrar el error pero no puede retomar el pago, y el tenant queda
    // atrapado en `pending_first_payment`. Este assert es el que hacia pasar el
    // bug: antes el test no mencionaba `initPoint`, asi que el handler podia
    // omitirlo sin que nadie lo notara.
    expect(body.initPoint).toBe(
      'https://www.mercadopago.com.ar/checkout/v1/redirect?pref=ya-existe',
    )
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('409 sin initPoint si MP no responde, y nunca un 5xx (item 65)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ mpPreapprovalId: 'preapproval-ya-existe' }))
    vi.mocked(getPreapproval).mockRejectedValue(new Error('MP timeout'))

    const res = await POST(req())
    const body = await res.json()

    // El invariante del design (secciones 3.5 y 6.2) es "si no resuelve ->
    // 200/409 + warn, nunca 5xx". Un doble click con MP caido no puede romper
    // el endpoint: se degrada a un 409 sin `initPoint`.
    expect(res.status).toBe(409)
    expect(body.preapprovalId).toBe('preapproval-ya-existe')
    expect(body.initPoint).toBeUndefined()
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('409 sin initPoint si MP responde sin el campo (item 65)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(sub({ mpPreapprovalId: 'preapproval-ya-existe' }))
    // El spike T0 demostro que MP devuelve 2xx al descartar campos sin avisar.
    vi.mocked(getPreapproval).mockResolvedValue({ id: 'preapproval-ya-existe' })

    const res = await POST(req())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.initPoint).toBeUndefined()
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

// ---------------------------------------------------------------------------
// Item 69 (H-F2-7): reserva antes de llamar a MP
// ---------------------------------------------------------------------------

describe('item 69 — reserva: doble POST concurrente', () => {
  it('crea UN solo preapproval en MP con dos POST en paralelo', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const slot: ReservationSlot = { holder: null, mine: null }
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(reservationTx(sub(), PLAN, slot)),
    )
    // Los 50 ms son la ventana real del bug: el request a MP tarda, y el 2do
    // POST entra mientras el 1ro esta esperando la respuesta.
    vi.mocked(createPreapproval).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return {
        id: 'preapproval-nuevo',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x',
      }
    })

    const responses = await Promise.all([POST(req()), POST(req())])

    // El punto del item: sin la reserva esto seria 2 llamadas a MP y un
    // preapproval huerfano que hay que cancelar a mano.
    expect(createPreapproval).toHaveBeenCalledTimes(1)
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409])
  })

  it('el 409 del perdedor no dice "ya tenes un preapproval"', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const slot: ReservationSlot = { holder: null, mine: null }
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(reservationTx(sub(), PLAN, slot)),
    )
    vi.mocked(createPreapproval).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return {
        id: 'preapproval-nuevo',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x',
      }
    })

    const responses = await Promise.all([POST(req()), POST(req())])
    const conflict = await (
      responses.find((r) => r.status === 409) as Response
    ).json()

    // No hay preapproval todavia: la reserva esta en curso. Decir "ya tenes un
    // preapproval" manda al tenant a uno que no existe.
    expect(conflict.error).toMatch(/en curso/i)
    expect(conflict.field).toBe('preapproval')
  })

  it('la reserva escribe un centinela antes de llamar a MP', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const slot: ReservationSlot = { holder: null, mine: null }
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(reservationTx(sub(), PLAN, slot)),
    )
    // El valor se captura DURANTE la llamada a MP: al terminar, la reserva ya
    // fue cerrada con el id real y `holder` es `closed:...`.
    let atMpCall: string | null = null
    vi.mocked(createPreapproval).mockImplementation(async () => {
      atMpCall = slot.holder
      return {
        id: 'preapproval-nuevo',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x',
      }
    })

    await POST(req())

    // La primera escritura tiene que ser la reserva, no el id de MP: cuando se
    // llama a MP todavia no existe ningun id que escribir.
    expect(atMpCall).toMatch(/^pending:/)
  })

  it('el id final de MP se escribe encima de la reserva', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const slot: ReservationSlot = { holder: null, mine: null }
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(reservationTx(sub(), PLAN, slot)),
    )

    const res = await POST(req())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.preapprovalId).toBe('preapproval-nuevo')
    expect(slot.holder).toBe('closed:pending:sub-1')
  })
})

describe('item 69 — la reserva tiene TTL', () => {
  it('409 con "creacion en curso" si la reserva es reciente', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    // Reserva viva: escrita hace 10 s, muy dentro del TTL.
    mockCtx(
      sub({
        mpPreapprovalId: 'pending:sub-1',
        updatedAt: new Date(Date.now() - 10_000),
      }),
    )

    const res = await POST(req())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/en curso/i)
    expect(body.retryInSeconds).toBeGreaterThan(0)
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('permite reservar de nuevo si la reserva vencio (proceso muerto)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const slot: ReservationSlot = { holder: null, mine: null }
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(
        reservationTx(
          sub({
            mpPreapprovalId: 'pending:sub-1',
            // Mas viejo que PENDING_RESERVATION_TTL_MS: nadie completo el
            // proceso. La reserva tiene que poder tomarse.
            updatedAt: new Date(Date.now() - 6 * 60_000),
          }),
          PLAN,
          slot,
        ),
      ),
    )

    const res = await POST(req())

    expect(res.status).toBe(201)
    expect(createPreapproval).toHaveBeenCalledTimes(1)
  })

  it('el TTL de la reserva es de 5 minutos', async () => {
    // La constante es parte del contrato con el tenant: "reintentá en X
    // minutos" tiene que ser cierto.
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockCtx(
      sub({
        mpPreapprovalId: 'pending:sub-1',
        updatedAt: new Date(Date.now() - 10_000),
      }),
    )

    const res = await POST(req())
    const body = await res.json()

    // ~5 min menos los 10 s que pasaron.
    expect(body.retryInSeconds).toBeGreaterThan(250)
    expect(body.retryInSeconds).toBeLessThanOrEqual(300)
  })

  it('un preapproval real (no centinela) no se confunde con una reserva', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    // Aunque sea viejo, un id de MP es un id de MP: no se puede re-reservar.
    mockCtx(
      sub({
        mpPreapprovalId: 'preapproval-real',
        updatedAt: new Date(Date.now() - 60 * 60_000),
      }),
    )

    const res = await POST(req())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.preapprovalId).toBe('preapproval-real')
    expect(createPreapproval).not.toHaveBeenCalled()
  })
})

describe('item 69 — la reserva sobrevive a la llamada de MP', () => {
it('si el cierre no puede escribir, el huerfano queda registrado', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const slot: ReservationSlot = { holder: null, mine: null }
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(reservationTx(sub(), PLAN, slot)),
    )
    // La reserva se gana normalmente. El takeover ocurre DURANTE la llamada a
    // MP, que es la ventana real del bug: entre que reservamos y que cerramos.
    vi.mocked(createPreapproval).mockImplementation(async () => {
      slot.holder = 'pending:otra-suscripcion'
      return {
        id: 'preapproval-nuevo',
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=x',
      }
    })

    const res = await POST(req())
    const body = await res.json()

    // El preapproval existe en MP pero la DB no lo apunta: no se puede
    // devolver 201. El 409 lo dice explicitamente en vez de mentir.
    expect(res.status).toBe(409)
    expect(body.preapprovalId).toBe('preapproval-nuevo')
    expect(body.error).toMatch(/soporte/i)
    expect(createPreapproval).toHaveBeenCalledTimes(1)
  })
})
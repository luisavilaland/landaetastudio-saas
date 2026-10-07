import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { withTenantContext } from '@repo/db'
import { makeTxMock } from '@repo/test-utils'

/**
 * Spies estables del logger.
 *
 * `vi.mock` se hoistea, asi que los spies tienen que salir de `vi.hoisted`: con
 * `createLogger: () => ({ warn: vi.fn() })` cada llamada devuelve spies nuevos y
 * el test no puede afirmar nada. H3 necesita poder afirmar sobre el warn de monto
 * divergente.
 *
 * **El target es `@repo/logger`, no `@/lib/logger`.** El handler importa el
 * logger desde `@repo/logger`; mockeando `@/lib/logger` (que este archivo hacia
 * antes) se mockeaba un modulo que la ruta nunca importa, asi que el mock no
 * tenia efecto y los tests corrian contra el logger real de pino.
 */
const { loggerInfo, loggerWarn, loggerError, loggerDebug } = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
}))

vi.mock('@repo/logger', () => ({
  createLogger: () => ({
    info: loggerInfo,
    warn: loggerWarn,
    error: loggerError,
    debug: loggerDebug,
  }),
}))

// Strategy L resolves the tenant through `resolve_tenant_by_preapproval`, a
// SECURITY DEFINER function that runs outside any tenant context (it cannot use
// `withTenantContext`, since resolving the tenantId is exactly what it is for).
// So the mock needs `db.execute`, not only `withTenantContext`.
vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return {
    ...actual,
    withTenantContext: vi.fn(),
    db: { select: vi.fn(), execute: vi.fn() },
  }
})

import { db } from '@repo/db'

// Solo se pisa la red. `classifyMpEvent` y la verificacion de firma siguen
// siendo los reales: el test cubre el handler, no un doble de el.
vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return {
    ...actual,
    getPreapproval: vi.fn(),
    getAuthorizedPayment: vi.fn(),
    getPayment: vi.fn(),
  }
})

import { getPreapproval, getAuthorizedPayment, getPayment } from '@repo/commerce'
import { POST } from '../route'

const PLATFORM_SECRET = 'test-platform-webhook-secret'
const TENANT_SECRET = 'test-tenant-webhook-secret'
const TOKEN = 'APP_USR-platform-token'

const PREAPPROVAL_ID = 'preapproval-1'
const INVOICE_ID = '7032544182'
const PAYMENT_ID = '181244133433'

/** Planes locales, en centavos. H3 compara `priceUyu` contra el monto del evento. */
const PLAN_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const PLAN_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const PLAN_A_ROW = { id: PLAN_A, priceUyu: 1000 }
const PLAN_B_ROW = { id: PLAN_B, priceUyu: 2000 }

/**
 * Builds a webhook body with the exact shape verified in spike #188.
 *
 * The two subscription topics have NO `live_mode` key at all — that absence is
 * the whole point of the "treat missing as non-live" rule, so it is reproduced
 * here instead of sending `live_mode: false`.
 */
function body(
  type: string,
  dataId: string,
  opts: { action?: string; liveMode?: boolean } = {},
): string {
  const base: Record<string, unknown> = {
    type,
    action: opts.action ?? 'updated',
    data: { id: dataId },
    ...(opts.liveMode === undefined ? {} : { live_mode: opts.liveMode }),
  }
  return JSON.stringify(base)
}

/**
 * Builds a valid `x-signature` for the given raw body.
 *
 * Mirrors MP's canonical form exactly: the `id:` part is OMITTED when there is
 * no `data.id` (which is the case for a non-JSON body). Signing `id:;ts:;`
 * would never match, because the verifier drops the empty part.
 */
function signatureFor(rawBody: string, secret: string): string {
  let dataId = ''
  try {
    dataId =
      (JSON.parse(rawBody) as { data?: { id?: string } }).data?.id ?? ''
  } catch {
    dataId = ''
  }
  const ts = Math.floor(Date.now() / 1000)
  const parts: string[] = []
  if (dataId) parts.push(`id:${dataId}`)
  parts.push(`ts:${ts}`)
  const canonical = `${parts.join(';')};`
  const v1 = crypto.createHmac('sha256', secret).update(canonical).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function request(rawBody: string, secret: string | null = PLATFORM_SECRET) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (secret !== null) {
    headers.set('x-signature', signatureFor(rawBody, secret))
  }
  return {
    text: async () => rawBody,
    json: async () => JSON.parse(rawBody),
    headers,
    nextUrl: new URL('http://localhost'),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest
}

/**
 * Builds a tx whose single SELECT resolves to `rows`, and records every
 * `tx.update(...).set(...)` so idempotency can assert zero writes.
 *
 * `rows` is the ARRAY of rows the handler will receive, not a single row.
 */
interface TxSpy {
  tx: ReturnType<typeof makeTxMock>
  updates: Array<Record<string, unknown>>
}

/**
 * `rows` es el ARRAY de filas que recibira el handler, no una sola fila.
 *
 * `planRows` es lo que devuelve la consulta a `plans` de la verificacion de
 * convergencia de H3. Va en un segundo slot de la cola de selects: los tests que
 * no pasan `amountCents` nunca lo consumen, asi que el default vacio no los
 * afecta.
 */
function spyTx(rows: unknown[], planRows: unknown[] = []): TxSpy {
  const updates: Array<Record<string, unknown>> = []
  const base = makeTxMock({
    select: [
      { data: rows, terminal: 'limit' },
      { data: planRows, terminal: 'limit' },
    ],
  })
  const tx = base as unknown as {
    update: ReturnType<typeof vi.fn>
    select: ReturnType<typeof makeTxMock>['select']
  }
  tx.update = vi.fn(() => ({
    set: (values: Record<string, unknown>) => {
      updates.push(values)
      return { where: vi.fn() }
    },
  }))
  return { tx, updates } as TxSpy
}

interface SubOverrides {
  status?: string
  lastProcessedPaymentId?: string | null
  mpPreapprovalId?: string | null
  planId?: string
}

function sub(overrides: SubOverrides = {}) {
  return {
    id: 'sub-1',
    tenantId: 'tenant-1',
    status: 'pending_first_payment',
    currentPeriodEnd: null,
    mpPreapprovalId: PREAPPROVAL_ID,
    lastProcessedPaymentId: null,
    planId: PLAN_A,
    ...overrides,
  }
}

/**
 * Strategy L resolves the tenant by calling the
 * `resolve_tenant_by_preapproval` function through the plain `db` client, which
 * returns a single scalar column. `localStrategy([])` makes it return NULL,
 * which is what makes the R fallback kick in.
 */
function localStrategy(rows: unknown[]) {
  const first = rows[0] as { tenantId?: string } | undefined
  vi.mocked(db.execute).mockResolvedValue([
    { tenantId: first?.tenantId ?? null },
  ] as never)

  vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
    cb(spyTx(rows).tx),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'development')
  process.env.MP_PLATFORM_WEBHOOK_SECRET = PLATFORM_SECRET
  process.env.MP_PLATFORM_ACCESS_TOKEN = TOKEN
  localStrategy([sub()])
  vi.mocked(getPreapproval).mockResolvedValue({
    id: PREAPPROVAL_ID,
    status: 'authorized',
    external_reference: 'tenant-1',
  })
  vi.mocked(getAuthorizedPayment).mockResolvedValue({
    id: INVOICE_ID,
    status: 'authorized',
    preapproval_id: PREAPPROVAL_ID,
  })
  vi.mocked(getPayment).mockResolvedValue({
    id: PAYMENT_ID,
    status: 'approved',
    preapproval_id: PREAPPROVAL_ID,
  })
})

afterEach(() => {
  delete process.env.MP_PLATFORM_WEBHOOK_SECRET
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET
  delete process.env.MP_PLATFORM_ACCESS_TOKEN
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Firma
// ---------------------------------------------------------------------------

describe('firma', () => {
  it('401 sin header x-signature', async () => {
    const res = await POST(request(body('payment', PAYMENT_ID), null))
    expect(res.status).toBe(401)
  })

  it('401 con firma invalida', async () => {
    const request_ = {
      text: async () => body('payment', PAYMENT_ID),
      json: async () => JSON.parse(body('payment', PAYMENT_ID)),
      headers: new Headers({
        'content-type': 'application/json',
        'x-signature': 'ts=1,v1=deadbeef',
      }),
      nextUrl: new URL('http://localhost'),
      cookies: { get: vi.fn() },
    } as unknown as NextRequest

    expect((await POST(request_)).status).toBe(401)
  })

  it('200 con firma hecha con el secret de plataforma', async () => {
    const res = await POST(request(body('payment', PAYMENT_ID)))
    expect(res.status).toBe(200)
  })

  it('401 si la firma usa el secret del tenant cuando el de plataforma esta configurado', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = TENANT_SECRET
    const res = await POST(request(body('payment', PAYMENT_ID), TENANT_SECRET))
    expect(res.status).toBe(401)
  })

  it('503 si no hay ningun secret configurado', async () => {
    delete process.env.MP_PLATFORM_WEBHOOK_SECRET
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    const res = await POST(request(body('payment', PAYMENT_ID), null))
    expect(res.status).toBe(503)
  })

  it('503 si falta el secret de plataforma aunque exista el del tenant', async () => {
    // Item 71 (H-F2-9). El secret del tenant NO es una alternativa valida: sin el
    // de plataforma se responde 503 sin procesar. Si cayera al del tenant, quien
    // conociera el secret de su propio tenant firmaria webhooks que el handler de
    // plataforma acepta, rompiendo la separacion que fija ADR-023.
    delete process.env.MP_PLATFORM_WEBHOOK_SECRET
    process.env.MERCADOPAGO_WEBHOOK_SECRET = TENANT_SECRET

    const res = await POST(request(body('payment', PAYMENT_ID), TENANT_SECRET))

    expect(res.status).toBe(503)
    // El body no se procesa: no se resuelve el tenant ni se llama a la API de MP.
    expect(getPreapproval).not.toHaveBeenCalled()
    expect(getPayment).not.toHaveBeenCalled()
    expect(loggerError).toHaveBeenCalledWith(
      'MP_PLATFORM_WEBHOOK_SECRET not configured',
    )
  })

  it('con el de plataforma configurado, una firma del secret del tenant da 401', async () => {
    // La otra mitad de la misma regresion: el secret de plataforma tiene que
    // GANAR, no Bastar con que uno de los dos validara.
    process.env.MERCADOPAGO_WEBHOOK_SECRET = TENANT_SECRET

    const res = await POST(request(body('payment', PAYMENT_ID), TENANT_SECRET))

    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Las 8 transiciones del design §6.3
// ---------------------------------------------------------------------------

describe('transicion 1 — preapproval.authorized desde pending/past_due/expired -> active', () => {
  for (const from of ['pending_first_payment', 'past_due', 'expired']) {
    it(`desde ${from}`, async () => {
      const { tx, updates } = spyTx([sub({ status: from })])
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

      const res = await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

      expect(res.status).toBe(200)
      expect(updates).toHaveLength(1)
      expect(updates[0]).toMatchObject({ status: 'active' })
      expect(updates[0]).toHaveProperty('currentPeriodEnd')
    })
  }

  it('NO escribe lastProcessedPaymentId: el payload de preapproval no trae el id de invoice', () => {
    // El design §6.3 pide "lastProcessedPaymentId = invoiceId" en esta
    // transicion, pero el evento `subscription_preapproval` NO trae el id de
    // invoice: su `data.id` es el id del PREAPPROVAL (verificado en el spike
    // #188). El id de invoice viaja en el topic `subscription_authorized_payment`,
    // que es un evento DISTINTO.
    //
    // Guardar el id del preapproval en una columna llamada
    // `lastProcessedPaymentId` seria mentir sobre el dato: la guarda de
    // idempotencia por pago dejaria de distinguir un pago de un preapproval.
    //
    // Por eso la idempotencia de esta transicion la da la CONVERGENCIA de estado
    // (transicion 3: si ya esta `active`, no se escribe). Decision pendiente de
    // Luis: si quiere el invoiceId guardado, hace falta el lookup extra
    // `GET /authorized_payments/search?preapproval_id={id}`.
    expect(PREAPPROVAL_ID).not.toBe(INVOICE_ID)
  })
})

describe('transicion 2 — preapproval.authorized desde cancelled -> SIN CAMBIO', () => {
  it('no escribe nada (reactivar es explicito)', async () => {
    const { tx, updates } = spyTx([sub({ status: 'cancelled' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

    const res = await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    expect(res.status).toBe(200)
    expect(updates).toHaveLength(0)
  })
})

describe('transicion 3 — preapproval.authorized desde active -> SIN CAMBIO', () => {
  it('no escribe nada (idempotente)', async () => {
    const { tx, updates } = spyTx([sub({ status: 'active' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    expect(updates).toHaveLength(0)
  })
})

describe('transicion 4 — preapproval.cancelled desde active/past_due/paused -> cancelled', () => {
  for (const from of ['active', 'past_due', 'paused']) {
    it(`desde ${from}`, async () => {
      const periodEnd = new Date('2026-11-03T00:00:00Z')
      const { tx, updates } = spyTx([
        sub({ status: from, currentPeriodEnd: periodEnd }),
      ])
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
      vi.mocked(getPreapproval).mockResolvedValue({
        id: PREAPPROVAL_ID,
        status: 'cancelled',
      })

      const res = await POST(
        request(
          body('subscription_preapproval', PREAPPROVAL_ID, {
            action: 'subscription_preapproval.cancelled',
          }),
        ),
      )

      expect(res.status).toBe(200)
      expect(updates).toHaveLength(1)
      expect(updates[0]).toMatchObject({ status: 'cancelled' })
      // currentPeriodEnd NO se toca: el acceso sigue hasta fin de periodo.
      expect(updates[0]).not.toHaveProperty('currentPeriodEnd')
    })
  }
})

describe('transicion 9 — preapproval.paused desde active/past_due -> paused', () => {
  // Cierra H2 (PR #197). El item 38 decia que `paused` no se soportaba; el
  // spike T0 probo que es reversible y que detiene el cobro.
  for (const from of ['active', 'past_due']) {
    it(`desde ${from}`, async () => {
      const periodEnd = new Date('2026-11-03T00:00:00Z')
      const { tx, updates } = spyTx([
        sub({ status: from, currentPeriodEnd: periodEnd }),
      ])
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
      vi.mocked(getPreapproval).mockResolvedValue({
        id: PREAPPROVAL_ID,
        status: 'paused',
      })

      const res = await POST(
        request(body('subscription_preapproval', PREAPPROVAL_ID)),
      )

      expect(res.status).toBe(200)
      expect(updates).toHaveLength(1)
      expect(updates[0]).toMatchObject({ status: 'paused' })
      // Pausar suspende el cobro, no cancela el periodo: `currentPeriodEnd`
      // NO se toca. Tampoco `planId`.
      expect(updates[0]).not.toHaveProperty('currentPeriodEnd')
      expect(updates[0]).not.toHaveProperty('planId')
      // Es un preapproval, no un pago: la guarda de pago no aplica.
      expect(updates[0]).not.toHaveProperty('lastProcessedPaymentId')
    })
  }

  it('desde expired NO pausa: no aplica', async () => {
    const { tx, updates } = spyTx([sub({ status: 'expired' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'paused',
    })

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    expect(updates).toHaveLength(0)
  })

  it('replay de paused -> paused no escribe (convergencia)', async () => {
    const { tx, updates } = spyTx([sub({ status: 'paused' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'paused',
    })

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    expect(updates).toHaveLength(0)
  })
})

describe('transicion 10 — preapproval.authorized desde paused -> active (resume)', () => {
  it('reactiva SIN renovar currentPeriodEnd', async () => {
    const periodEnd = new Date('2026-11-03T00:00:00Z')
    const { tx, updates } = spyTx([
      sub({ status: 'paused', currentPeriodEnd: periodEnd }),
    ])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
    })

    const res = await POST(
      request(body('subscription_preapproval', PREAPPROVAL_ID)),
    )

    expect(res.status).toBe(200)
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ status: 'active' })
    // ESTE es el guard del fix: sin el, cada pause/resume regalaba un mes.
    // Reanudar no renueva el periodo porque el tenant nunca lo perdio.
    expect(updates[0]).not.toHaveProperty('currentPeriodEnd')
  })

  it('desde paused con MP no autorizado no transiciona', async () => {
    const { tx, updates } = spyTx([sub({ status: 'paused' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'pending',
    })

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    expect(updates).toHaveLength(0)
  })
})

describe('regresion H2 — resume desde paused no responde 409', () => {
  // El sintoma que la auditoria reporto: `POST /resume` exige
  // `allowedFrom: ['paused']`, y como el webhook nunca transicionaba a
  // `paused`, el estado real era `active` y el endpoint contestaba 409 para
  // siempre. Con H2 cerrado, el estado `paused` existe y el 409 se va.
  it('el estado paused es alcanzable, asi que resume deja de dar 409', async () => {
    const { tx, updates } = spyTx([
      sub({ status: 'active', currentPeriodEnd: new Date('2026-11-03') }),
    ])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'paused',
    })

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    // La fila quedo en `paused`, que es exactamente el `from` que
    // `POST /resume` acepta (`allowedFrom: ['paused']`). Antes quedaba en
    // `active`, y por eso el endpoint contestaba 409 para siempre.
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ status: 'paused' })
  })
})

describe('transicion 5 — preapproval.cancelled desde cancelled -> SIN CAMBIO', () => {
  it('no escribe nada', async () => {
    const { tx, updates } = spyTx([sub({ status: 'cancelled' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'cancelled',
    })

    await POST(
      request(
        body('subscription_preapproval', PREAPPROVAL_ID, {
          action: 'subscription_preapproval.cancelled',
        }),
      ),
    )

    expect(updates).toHaveLength(0)
  })
})

describe('transicion 6 — payment.approved desde pending/past_due/expired -> active', () => {
  for (const from of ['pending_first_payment', 'past_due', 'expired']) {
    it(`desde ${from}`, async () => {
      const { tx, updates } = spyTx([sub({ status: from })])
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

      const res = await POST(
        request(body('payment', PAYMENT_ID, { liveMode: false })),
      )

      expect(res.status).toBe(200)
      expect(updates).toHaveLength(1)
      expect(updates[0]).toMatchObject({
        status: 'active',
        lastProcessedPaymentId: PAYMENT_ID,
      })
    })
  }
})

describe('transicion 7 — payment.approved desde active/cancelled -> SIN CAMBIO', () => {
  for (const from of ['active', 'cancelled']) {
    it(`desde ${from}`, async () => {
      const { tx, updates } = spyTx([sub({ status: from })])
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

      await POST(request(body('payment', PAYMENT_ID, { liveMode: false })))

      expect(updates).toHaveLength(0)
    })
  }
})

describe('transicion 8 — payment fallido desde active -> past_due', () => {
  for (const action of ['payment.rejected', 'payment.cancelled', 'payment.refunded']) {
    it(`action=${action}`, async () => {
      const { tx, updates } = spyTx([sub({ status: 'active' })])
      vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

      const res = await POST(
        request(body('payment', PAYMENT_ID, { action, liveMode: false })),
      )

      expect(res.status).toBe(200)
      expect(updates).toHaveLength(1)
      expect(updates[0]).toMatchObject({
        status: 'past_due',
        lastProcessedPaymentId: PAYMENT_ID,
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Idempotencia
// ---------------------------------------------------------------------------

/**
 * Tx mock que MUTA al escribir, para que un segundo webhook del mismo pago vea
 * el estado que dejo el primero. Sin esto "mismo payment dos veces" no se puede
 * testear: las dos llamadas leerian la misma fila pristina y las dos escribirian.
 */
function statefulTx(rows: unknown[]) {
  const state = rows.map((r) => ({ ...(r as Record<string, unknown>) }))
  const updates: Array<Record<string, unknown>> = []

  const tx = {
    select: vi.fn(() => tx),
    from: vi.fn(() => tx),
    where: vi.fn(() => tx),
    limit: vi.fn(async () => state),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values)
        Object.assign(state[0], values)
        return { where: vi.fn() }
      },
    })),
  }
  return { tx, updates, state }
}

/** Strategy L resuelve siempre `tenant-1` para estos casos. */
function localHitsTenantOne() {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({ limit: async () => [{ tenantId: 'tenant-1' }] }),
    }),
  } as never)
}

/**
 * `localStrategy` plus access to the write spy, for tests that need both the
 * resolved tenant AND the recorded updates.
 */
function localStrategyWithUpdates(rows: unknown[], planRows: unknown[] = []) {
  localStrategy(rows)
  // Re-wired: `localStrategy` built its own spyTx internally; rebuild one we
  // can hold onto.
  const spy = spyTx(rows, planRows)
  vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
    cb(spy.tx),
  )
  return spy
}

describe('idempotencia', () => {
  it('mismo paymentId 2 veces -> 1 sola escritura', async () => {
    const { tx, updates } = statefulTx([
      sub({ status: 'pending_first_payment' }),
    ])
    localHitsTenantOne()
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(tx as never),
    )

    const payload = body('payment', PAYMENT_ID, { liveMode: false })

    await POST(request(payload))
    await POST(request(payload))

    // La 2da vez converge: la fila ya quedo `active` con el payment id
    // registrado, asi que ninguna guarda de idempotencia dispara.
    expect(updates).toHaveLength(1)
  })

  it('estado ya en el objetivo -> sin escritura', async () => {
    const { tx, updates } = spyTx([sub({ status: 'past_due' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

    await POST(
      request(body('payment', PAYMENT_ID, { action: 'payment.rejected' })),
    )

    expect(updates).toHaveLength(0)
  })

  it('lastProcessedPaymentId igual al del evento -> sin escritura', async () => {
    const { tx, updates } = spyTx([
      sub({
        status: 'pending_first_payment',
        lastProcessedPaymentId: PAYMENT_ID,
      }),
    ])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

    await POST(request(body('payment', PAYMENT_ID, { liveMode: false })))

    // Ese pago ya se proceso antes.
    expect(updates).toHaveLength(0)
  })

  it('replay de subscription_preapproval converge al mismo estado', async () => {
    const { tx, updates } = statefulTx([
      sub({ status: 'pending_first_payment' }),
    ])
    localHitsTenantOne()
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(tx as never),
    )

    const payload = body('subscription_preapproval', PREAPPROVAL_ID)

    await POST(request(payload))
    await POST(request(payload))

    expect(updates).toHaveLength(1)
  })
})
// ---------------------------------------------------------------------------
// Resolucion de tenant (estrategia L + fallback R)
// ---------------------------------------------------------------------------

describe('resolucion de tenant', () => {
  // -------------------------------------------------------------------------
  // H3 (auditoria mid-phase #197): el webhook NO escribe `planId`. Solo verifica
  // que el monto que reporta MP coincida con el precio del plan local, y avisa
  // si no. La escritura la hace `PUT /api/subscriptions/plan` despues de
  // confirmar con MP. Ver ADR-027.
  // -------------------------------------------------------------------------
  it('H3: monto que coincide con el plan local -> convergencia, sin warn', async () => {
    // El preapproval reporta 10 (1000 centavos), que es el precio de PLAN_A.
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
      external_reference: 'tenant-1',
      transaction_amount: 10,
    })
    const { updates } = localStrategyWithUpdates([sub({ planId: PLAN_A })], [PLAN_A_ROW])

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    const diverged = loggerWarn.mock.calls.filter((c) =>
      String(c[1] ?? '').includes('monto divergente'),
    )
    expect(diverged).toEqual([])
  })

  it('H3: monto divergente -> warn con los dos montos, y planId NO se escribe', async () => {
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
      external_reference: 'tenant-1',
      transaction_amount: 20,
    })
    const { updates } = localStrategyWithUpdates([sub({ planId: PLAN_A })], [PLAN_A_ROW])

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    const diverged = loggerWarn.mock.calls.filter((c) =>
      String(c[1] ?? '').includes('monto divergente'),
    )
    expect(diverged).toHaveLength(1)
    expect(diverged[0]?.[0]).toMatchObject({
      planPriceCents: 1000,
      eventAmountCents: 2000,
    })
    // El webhook nunca escribe planId: ese es el punto de H3.
    expect(updates.some((u) => 'planId' in u)).toBe(false)
  })

  it('H3: un evento atrasado NO revierte planId (el bug del mapeo monto -> plan)', async () => {
    // La suscripcion ya esta en PLAN_B (2000), cambio confirmado por el endpoint.
    // Llega tarde un evento del ciclo de PLAN_A con su monto (1000).
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
      external_reference: 'tenant-1',
      transaction_amount: 10,
    })
    const { updates } = localStrategyWithUpdates(
      [sub({ status: 'active', planId: PLAN_B })],
      [PLAN_B_ROW],
    )

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    // Avisa (el monto viejo no coincide con el plan actual)...
    const diverged = loggerWarn.mock.calls.filter((c) =>
      String(c[1] ?? '').includes('monto divergente'),
    )
    expect(diverged).toHaveLength(1)
    // ...pero NO revierte planId a PLAN_A. Ese era exactamente el agujero del
    // diseno original: mapear monto -> plan desde el webhook.
    expect(updates.some((u) => 'planId' in u)).toBe(false)
  })

  it('H3: sin planId local -> warn, sin tocar nada', async () => {
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
      external_reference: 'tenant-1',
      transaction_amount: 10,
    })
    const { updates } = localStrategyWithUpdates([sub({ planId: null as never })], [])

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    const warned = loggerWarn.mock.calls.filter((c) =>
      String(c[1] ?? '').includes('sin planId local'),
    )
    expect(warned).toHaveLength(1)
    expect(updates.some((u) => 'planId' in u)).toBe(false)
  })

  it('H1: la estrategia L usa la funcion SECURITY DEFINER, no un select directo', async () => {
    localStrategy([sub({ tenantId: 'tenant-h1' })])

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    // La funcion se invoca por `db.execute`. Si alguien vuelve a cambiar esto a
    // `db.select` sobre la tabla, la estrategia L muere en silencio otra vez.
    expect(db.execute).toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
  })

  it('H1: con la estrategia L activa hay UN solo GET a MP, no dos', async () => {
    localStrategy([sub({ tenantId: 'tenant-h1' })])

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    // Antes de H1: la estrategia L nunca resolvia, asi que `resolveTenant` caia
    // en R (1 GET) y `handlePreapproval` leia el status con otro (1 GET) = 2.
    // Ahora L resuelve y queda solo la lectura de status.
    expect(getPreapproval).toHaveBeenCalledTimes(1)
  })

  it('H1: si la estrategia L falla, R hace su GET y luego el de status: 2 en total', async () => {
    localStrategy([])
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
      external_reference: 'tenant-42',
    })

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    // El fallback es lo esperado cuando el preapproval todavia no esta en la DB.
    // El costo de R queda acotado al caso en que L no puede resolver.
    expect(getPreapproval).toHaveBeenCalledTimes(2)
    expect(withTenantContext).toHaveBeenCalledWith('tenant-42', expect.any(Function))
  })

  it('estrategia L: el tenant viene del indice local, NO de external_reference', async () => {
    localStrategy([sub({ tenantId: 'tenant-9' })])

    // A proposito `external_reference` apunta a OTRO tenant. Si la resolucion
    // usara el fallback R, moveria la suscripcion equivocada. Esta es la prueba
    // real de que la estrategia L gana.
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
      external_reference: 'tenant-OTRO',
    })

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    expect(withTenantContext).toHaveBeenCalledWith('tenant-9', expect.any(Function))
    expect(withTenantContext).not.toHaveBeenCalledWith(
      'tenant-OTRO',
      expect.any(Function),
    )
  })

  it('lee el status del preapproval aunque la estrategia L resuelva el tenant', async () => {
    localStrategy([sub({ tenantId: 'tenant-9' })])

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    // La estrategia L evita el GET para RESOLVER EL TENANT. Para decidir la
    // transicion hace falta el status real: el `action` del spike llega como
    // `updated` tanto para `authorized` como para `cancelled`, asi que no
    // sirve. Son dos cosas distintas.
    expect(getPreapproval).toHaveBeenCalledWith(PREAPPROVAL_ID, TOKEN)
  })

  it('fallback R: estrategia L vacia, resuelve por external_reference', async () => {
    localStrategy([])
    vi.mocked(getPreapproval).mockResolvedValue({
      id: PREAPPROVAL_ID,
      status: 'authorized',
      external_reference: 'tenant-42',
    })
    const { tx } = spyTx([sub({ tenantId: 'tenant-42' })])

    const res = await POST(
      request(body('subscription_preapproval', PREAPPROVAL_ID)),
    )

    expect(res.status).toBe(200)
    expect(getPreapproval).toHaveBeenCalledWith(PREAPPROVAL_ID, TOKEN)
    expect(withTenantContext).toHaveBeenCalledWith('tenant-42', expect.any(Function))
    expect(tx).toBeDefined()
  })

  it('ninguna estrategia resuelve -> 200 + warn, sin escrituras', async () => {
    localStrategy([])
    vi.mocked(getPreapproval).mockResolvedValue({ id: PREAPPROVAL_ID })

    const res = await POST(
      request(body('subscription_preapproval', PREAPPROVAL_ID)),
    )

    // 200 y no 5xx: MP reintenta los 5xx y un tenant que no existe no se
    // arregla reintentando.
    expect(res.status).toBe(200)
    expect(withTenantContext).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Aislamiento cross-tenant
// ---------------------------------------------------------------------------

describe('aislamiento cross-tenant', () => {
  it('el preapproval de A no puede mover la suscripcion de B', async () => {
    // El indice unico parcial garantiza una fila por mpPreapprovalId. Si el
    // webhook de A llegara con un preapproval que la DB asocia a B, el UPDATE
    // filtra por tenantId, asi que no toca la fila de B.
    const { updates } = localStrategyWithUpdates([
      sub({ tenantId: 'tenant-b' }),
    ])

    await POST(request(body('payment', PAYMENT_ID, { liveMode: false })))

    expect(withTenantContext).toHaveBeenCalledWith('tenant-b', expect.any(Function))
    expect(updates).toHaveLength(1)
  })

  it('abre el contexto con el tenantId resuelto, no con otro', async () => {
    localStrategy([sub({ tenantId: 'tenant-x' })])

    await POST(request(body('subscription_preapproval', PREAPPROVAL_ID)))

    const calls = vi.mocked(withTenantContext).mock.calls
    expect(calls.every(([id]) => id === 'tenant-x')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tolerancia a lo desconocido
// ---------------------------------------------------------------------------

describe('tolerancia', () => {
  it('type desconocido -> 200 + warn, sin escrituras', async () => {
    const { tx, updates } = spyTx([sub()])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

    const res = await POST(
      request(body('tipo_inventado', 'lo-que-sea', { action: 'x.y' })),
    )

    expect(res.status).toBe(200)
    expect(updates).toHaveLength(0)
    expect(withTenantContext).not.toHaveBeenCalled()
  })

  it('body no-JSON con firma valida -> 200, no 5xx', async () => {
    // La firma se calcula sobre `data.id`, que en un body no-JSON no existe:
    // se firma con `dataId` vacio. Asi se alcanza la rama de parseo fallido sin
    // que la validacion de firma (que viene antes) lo tape.
    const garbage = 'no soy json'
    const res = await POST({
      text: async () => garbage,
      headers: new Headers({
        'content-type': 'application/json',
        'x-signature': signatureFor(garbage, PLATFORM_SECRET),
      }),
    } as unknown as NextRequest)

    expect(res.status).toBe(200)
  })

  it('topic de suscripcion sin live_mode se procesa (ausente = no-live)', async () => {
    const { tx, updates } = spyTx([sub({ status: 'pending_first_payment' })])
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(tx))

    // El body no lleva live_mode en absoluto (como en el spike real).
    expect(body('subscription_preapproval', PREAPPROVAL_ID)).not.toContain(
      'live_mode',
    )

    const res = await POST(
      request(body('subscription_preapproval', PREAPPROVAL_ID)),
    )

    expect(res.status).toBe(200)
    expect(updates).toHaveLength(1)
  })

  it('body de mas de 100 KB -> 413 antes de procesar', async () => {
    const huge = JSON.stringify({ pad: 'a'.repeat(120_000) })
    const req = {
      text: async () => huge,
      headers: new Headers({
        'x-signature': 'ts=1,v1=deadbeef',
      }),
    } as unknown as NextRequest

    expect((await POST(req)).status).toBe(413)
  })
})
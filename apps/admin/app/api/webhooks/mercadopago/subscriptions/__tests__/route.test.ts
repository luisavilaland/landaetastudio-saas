import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { POST } from '../route'

const PLATFORM_SECRET = 'test-platform-webhook-secret'
const TENANT_SECRET = 'test-tenant-webhook-secret'
const RAW_BODY = JSON.stringify({
  type: 'subscription_preapproval',
  action: 'subscription_preapproval.updated',
  data: { id: '999888777' },
  live_mode: true,
})

function extractDataId(rawBody: string): string | undefined {
  try {
    const parsed = JSON.parse(rawBody) as { data?: { id?: string } }
    return parsed.data?.id
  } catch {
    return undefined
  }
}

function makeSignature(dataId: string, ts: number, secret: string): string {
  const canonical = `id:${dataId};ts:${ts};`
  const v1 = crypto.createHmac('sha256', secret).update(canonical).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function makeWebhookRequest(secret: string): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' })
  const dataId = extractDataId(RAW_BODY) ?? ''
  headers.set(
    'x-signature',
    makeSignature(dataId, Math.floor(Date.now() / 1000), secret),
  )
  return {
    text: async () => RAW_BODY,
    json: async () => JSON.parse(RAW_BODY),
    headers,
    nextUrl: new URL('http://localhost'),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest
}

/**
 * Bug corregido en T5-prep: el stub validaba contra
 * MERCADOPAGO_WEBHOOK_SECRET (secret del TENANT, Flujo B) cuando los webhooks
 * de suscripciones llegan firmados con el secret de PLATAFORMA (Flujo A).
 * Con el secret equivocado, T5 habria medido 401 "Invalid signature" en vez de
 * 200, sin poder distinguir "no llego" de "llego y fue rechazado".
 */
describe('POST /api/webhooks/mercadopago/subscriptions — secret de plataforma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    delete process.env.MP_PLATFORM_WEBHOOK_SECRET
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    vi.unstubAllEnvs()
  })

  it('valida contra MP_PLATFORM_WEBHOOK_SECRET cuando esta configurado', async () => {
    process.env.MP_PLATFORM_WEBHOOK_SECRET = PLATFORM_SECRET
    process.env.MERCADOPAGO_WEBHOOK_SECRET = TENANT_SECRET

    const response = await POST(makeWebhookRequest(PLATFORM_SECRET))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
    expect(body.type).toBe('subscription_preapproval')
    expect(body.action).toBe('subscription_preapproval.updated')
    expect(body.dataId).toBe('999888777')
  })

  it('RECHAZA una firma hecha con el secret del tenant cuando el de plataforma esta configurado', async () => {
    // Esta es la asercion que falla sin el fix: antes el stub validaba con el
    // secret del tenant y devolvia 200.
    process.env.MP_PLATFORM_WEBHOOK_SECRET = PLATFORM_SECRET
    process.env.MERCADOPAGO_WEBHOOK_SECRET = TENANT_SECRET

    const response = await POST(makeWebhookRequest(TENANT_SECRET))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid signature',
    })
  })

  it('cae al secret del tenant si el de plataforma no esta configurado', async () => {
    delete process.env.MP_PLATFORM_WEBHOOK_SECRET
    process.env.MERCADOPAGO_WEBHOOK_SECRET = TENANT_SECRET

    const response = await POST(makeWebhookRequest(TENANT_SECRET))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ received: true })
  })

  it('devuelve 503 si no hay ninguno de los dos secrets', async () => {
    delete process.env.MP_PLATFORM_WEBHOOK_SECRET
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET

    const response = await POST(makeWebhookRequest(PLATFORM_SECRET))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Webhook not configured',
    })
  })

  it('sin header x-signature responde 401 aunque los secrets esten configurados', async () => {
    process.env.MP_PLATFORM_WEBHOOK_SECRET = PLATFORM_SECRET

    const request = {
      text: async () => RAW_BODY,
      json: async () => JSON.parse(RAW_BODY),
      headers: new Headers({ 'content-type': 'application/json' }),
      nextUrl: new URL('http://localhost'),
      cookies: { get: vi.fn() },
    } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Missing signature',
    })
  })

  it('rechaza un body de mas de 100 KB antes de tocar la firma', async () => {
    process.env.MP_PLATFORM_WEBHOOK_SECRET = PLATFORM_SECRET
    const huge = JSON.stringify({ pad: 'a'.repeat(120_000) })

    const request = {
      text: async () => huge,
      json: async () => JSON.parse(huge),
      headers: new Headers({
        'content-type': 'application/json',
        'x-signature': 'ts=1,v1=deadbeef',
      }),
      nextUrl: new URL('http://localhost'),
      cookies: { get: vi.fn() },
    } as unknown as NextRequest

    const response = await POST(request)

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: 'Payload too large',
    })
  })
})
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@repo/logger'
import { verifyMercadoPagoSignature } from '@repo/commerce'

// TEMPORAL — stub endurecido del spike T0 (v2). NO es el handler de T5.
//
// v1 (preview) era aceptable solo en un preview domain: sin firma, sin limite
// de body, escribiendo el payload crudo a disco. Eso no puede exponerse en
// `admin.landaetastudio.com`.
//
// v2 lo hace apto para produccion:
//   1. Verifica la firma HMAC con `verifyMercadoPagoSignature` (reutilizado
//      del webhook del storefront, sin logica duplicada).
//   2. Limita el body a 100 KB antes de parsear.
//   3. Loguea SOLO metadata estructural. No persiste el body crudo: el
//      objetivo de P1 es resolver `type`/`action`, y esos si quedan visibles
//      en el log sin exponer PII ni datos de tarjeta.
//
// Sigue sin validar el shape con Zod a proposito: el payload crudo es
// justamente lo que hay que descubrir. Un schema asumido invalidaria el
// spike.

const logger = createLogger('spike-t0-stub-v2')

const MAX_BODY_BYTES = 100 * 1024

export const dynamic = 'force-dynamic'

type StructuralSummary = {
  type: unknown
  action: unknown
  dataId: unknown
  liveMode: unknown
  topLevelKeys: string[]
}

export async function POST(request: NextRequest) {
  try {
    // Los webhooks de suscripciones llegan firmados con el secret de la cuenta
    // de PLATAFORMA (Flujo A), no con el del tenant (Flujo B). Validar con el
    // equivocado produce 401 "Invalid signature" sobre un webhook que si llego,
    // lo que vuelve ambigua la medicion de H1 vs H3.
    // Fallback al del tenant para entornos que todavia no tengan el de
    // plataforma configurado (dev / preview).
    const webhookSecret =
      process.env.MP_PLATFORM_WEBHOOK_SECRET ??
      process.env.MERCADOPAGO_WEBHOOK_SECRET

    if (!webhookSecret) {
      logger.error(
        'No webhook secret configured (MP_PLATFORM_WEBHOOK_SECRET or MERCADOPAGO_WEBHOOK_SECRET)',
      )
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 },
      )
    }

    const rawBody = await request.text()

    if (rawBody.length > MAX_BODY_BYTES) {
      logger.warn(
        { bytes: rawBody.length, limit: MAX_BODY_BYTES },
        'Body too large — rejected',
      )
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const signature = request.headers.get('x-signature')

    if (!signature) {
      logger.warn('Missing x-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    const dataId = extractDataId(rawBody)
    const verification = verifyMercadoPagoSignature({
      signatureHeader: signature,
      xRequestId: request.headers.get('x-request-id') ?? '',
      dataId: dataId ?? '',
      secret: webhookSecret,
    })

    if (!verification.valid) {
      logger.warn({ reason: verification.reason }, 'Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const summary = summarize(rawBody)

    // `type` y `action` son el objetivo de P1. Se loguean para poder
    // resolver los literales desde Vercel Logs sin persistir el payload.
    logger.info(summary, 'Webhook received (signature verified)')

    return NextResponse.json({
      received: true,
      type: summary.type ?? null,
      action: summary.action ?? null,
      dataId: summary.dataId ?? null,
    })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      'Failed to process webhook',
    )
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 },
    )
  }
}

function extractDataId(rawBody: string): string | undefined {
  try {
    const parsed = JSON.parse(rawBody) as { data?: { id?: string } }
    return parsed.data?.id
  } catch {
    return undefined
  }
}

/**
 * Reduce el payload a lo que el spike necesita, sin retener PII. El
 * `topLevelKeys` permite detectar campos que no figuran en la documentacion,
 * sin volcar valores.
 */
function summarize(rawBody: string): StructuralSummary {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    const data = (parsed.data ?? {}) as Record<string, unknown>

    return {
      type: parsed.type,
      action: parsed.action,
      dataId: data.id ?? null,
      liveMode: parsed.live_mode ?? null,
      topLevelKeys: Object.keys(parsed).sort(),
    }
  } catch {
    return {
      type: undefined,
      action: undefined,
      dataId: undefined,
      liveMode: undefined,
      topLevelKeys: [],
    }
  }
}

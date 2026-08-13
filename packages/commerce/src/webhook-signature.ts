import crypto from 'crypto'

export type MercadoPagoSignatureResult = {
  valid: boolean
  reason?: string
}

export type VerifyMercadoPagoSignatureParams = {
  signatureHeader: string
  xRequestId: string
  dataId: string
  secret: string
  now?: number
  toleranceSeconds?: number
}

function parseSignatureHeader(header: string): {
  wellFormed: boolean
  ts?: string
  v1?: string
} {
  const parsed: { ts?: string; v1?: string } = {}

  for (const segment of header.split(',')) {
    const eq = segment.indexOf('=')
    if (eq === -1) return { wellFormed: false }
    const key = segment.slice(0, eq).trim()
    const value = segment.slice(eq + 1).trim()
    if (key === 'ts') parsed.ts = value
    else if (key === 'v1') parsed.v1 = value
  }

  return { wellFormed: true, ...parsed }
}

export type MakeSignatureParams = {
  dataId: string
  ts: number
  xRequestId?: string
  secret: string
}

export function makeSignature(params: MakeSignatureParams): string {
  const { dataId, ts, xRequestId = '', secret } = params
  const parts = [
    dataId ? `id:${dataId}` : '',
    xRequestId ? `request-id:${xRequestId}` : '',
    ts ? `ts:${ts}` : '',
  ].filter(Boolean)
  const canonical = `${parts.join(';')};`
  const v1 = crypto.createHmac('sha256', secret).update(canonical).digest('hex')
  return `ts=${ts},v1=${v1}`
}

export function verifyMercadoPagoSignature(
  params: VerifyMercadoPagoSignatureParams,
): MercadoPagoSignatureResult {
  const { signatureHeader, xRequestId, dataId, secret } = params
  const now = params.now ?? Date.now()
  const toleranceSeconds = params.toleranceSeconds ?? 300

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed.wellFormed) return { valid: false, reason: 'invalid-format' }
  if (parsed.ts === undefined || parsed.ts === '')
    return { valid: false, reason: 'missing-ts' }
  if (parsed.v1 === undefined || parsed.v1 === '')
    return { valid: false, reason: 'missing-parts' }

  const parts: string[] = []
  if (dataId) parts.push(`id:${dataId}`)
  if (xRequestId) parts.push(`request-id:${xRequestId}`)
  if (parsed.ts) parts.push(`ts:${parsed.ts}`)
  if (parts.length === 0) return { valid: false, reason: 'missing-parts' }
  const canonical = `${parts.join(';')};`

  const tsMs = Number(parsed.ts) * 1000
  if (Number.isNaN(tsMs)) return { valid: false, reason: 'invalid-format' }

  if (Math.abs(now - tsMs) > toleranceSeconds * 1000) {
    return { valid: false, reason: 'timestamp-expired' }
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest()
  const received = Buffer.from(parsed.v1, 'hex')

  if (received.length !== expected.length) {
    return { valid: false, reason: 'signature-mismatch' }
  }

  if (!crypto.timingSafeEqual(received, expected)) {
    return { valid: false, reason: 'signature-mismatch' }
  }

  return { valid: true }
}

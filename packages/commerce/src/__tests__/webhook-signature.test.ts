import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { makeSignature, verifyMercadoPagoSignature } from '../webhook-signature'

const SECRET = 'test-webhook-secret'
const NOW = 1_700_000_000_000
const TS = Math.floor(NOW / 1000)

describe('verifyMercadoPagoSignature', () => {
  it('should accept a valid signature with x-request-id', () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: makeSignature({
        dataId: 'pay-123',
        xRequestId: 'req-abc-123',
        ts: TS,
        secret: SECRET,
      }),
      xRequestId: 'req-abc-123',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: true })
  })

  it('should accept a valid signature without x-request-id', () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: makeSignature({
        dataId: 'pay-123',
        ts: TS,
        secret: SECRET,
      }),
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: true })
  })

  it('should sign the exact canonical id:...;request-id:...;ts:...;', () => {
    const canonical = `id:pay-123;request-id:req-abc-123;ts:${TS};`
    const v1 = crypto
      .createHmac('sha256', SECRET)
      .update(canonical)
      .digest('hex')

    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${TS},v1=${v1}`,
        xRequestId: 'req-abc-123',
        dataId: 'pay-123',
        secret: SECRET,
        now: NOW,
      }).valid,
    ).toBe(true)

    const wrongOrder = `request-id:req-abc-123;id:pay-123;ts:${TS};`
    const wrongV1 = crypto
      .createHmac('sha256', SECRET)
      .update(wrongOrder)
      .digest('hex')

    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${TS},v1=${wrongV1}`,
        xRequestId: 'req-abc-123',
        dataId: 'pay-123',
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ valid: false, reason: 'signature-mismatch' })
  })

  it('should reject when the secret is wrong', () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: makeSignature({
        dataId: 'pay-123',
        xRequestId: 'req-abc-123',
        ts: TS,
        secret: 'wrong-secret',
      }),
      xRequestId: 'req-abc-123',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: false, reason: 'signature-mismatch' })
  })

  it('should omit empty parts from the canonical', () => {
    const canonicalWithoutId = `request-id:req-abc-123;ts:${TS};`
    const v1WithoutId = crypto
      .createHmac('sha256', SECRET)
      .update(canonicalWithoutId)
      .digest('hex')

    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${TS},v1=${v1WithoutId}`,
        xRequestId: 'req-abc-123',
        dataId: '',
        secret: SECRET,
        now: NOW,
      }).valid,
    ).toBe(true)

    const canonicalWithoutRequestId = `id:pay-123;ts:${TS};`
    const v1WithoutRequestId = crypto
      .createHmac('sha256', SECRET)
      .update(canonicalWithoutRequestId)
      .digest('hex')

    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${TS},v1=${v1WithoutRequestId}`,
        xRequestId: '',
        dataId: 'pay-123',
        secret: SECRET,
        now: NOW,
      }).valid,
    ).toBe(true)
  })

  it('should accept a timestamp within the tolerance window', () => {
    const nearEdge = Math.floor((NOW - 300_000) / 1000)
    const result = verifyMercadoPagoSignature({
      signatureHeader: makeSignature({
        dataId: 'pay-123',
        ts: nearEdge,
        secret: SECRET,
      }),
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result.valid).toBe(true)
  })

  it('should reject a timestamp older than the tolerance window', () => {
    const expired = Math.floor((NOW - 301_000) / 1000)
    const result = verifyMercadoPagoSignature({
      signatureHeader: makeSignature({
        dataId: 'pay-123',
        ts: expired,
        secret: SECRET,
      }),
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: false, reason: 'timestamp-expired' })
  })

  it('should reject a timestamp in the future', () => {
    const future = Math.floor((NOW + 3_600_000) / 1000)
    const result = verifyMercadoPagoSignature({
      signatureHeader: makeSignature({
        dataId: 'pay-123',
        ts: future,
        secret: SECRET,
      }),
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: false, reason: 'timestamp-expired' })
  })

  it('should reject a header without ts', () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: 'v1=abcdef0123456789',
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: false, reason: 'missing-ts' })
  })

  it('should reject a header without v1', () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: `ts=${TS}`,
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: false, reason: 'missing-parts' })
  })

  it('should reject a header that cannot be parsed', () => {
    const result = verifyMercadoPagoSignature({
      signatureHeader: 'not-a-signature',
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: false, reason: 'invalid-format' })
  })

  it('should reject a v1 of different length without throwing', () => {
    const shortV1 = 'deadbeef'
    const result = verifyMercadoPagoSignature({
      signatureHeader: `ts=${TS},v1=${shortV1}`,
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: false, reason: 'signature-mismatch' })
  })

  it('should accept spaces around equals signs and commas', () => {
    const canonical = `id:pay-123;ts:${TS};`
    const v1 = crypto
      .createHmac('sha256', SECRET)
      .update(canonical)
      .digest('hex')
    const result = verifyMercadoPagoSignature({
      signatureHeader: ` ts = ${TS} , v1 = ${v1} `,
      xRequestId: '',
      dataId: 'pay-123',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: true })
  })

  it('should accept a signature when dataId and xRequestId are both absent', () => {
    const canonical = `ts:${TS};`
    const v1 = crypto
      .createHmac('sha256', SECRET)
      .update(canonical)
      .digest('hex')
    const result = verifyMercadoPagoSignature({
      signatureHeader: `ts=${TS},v1=${v1}`,
      xRequestId: '',
      dataId: '',
      secret: SECRET,
      now: NOW,
    })

    expect(result).toEqual({ valid: true })
  })
})

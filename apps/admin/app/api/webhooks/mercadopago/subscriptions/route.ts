import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createLogger } from '@repo/logger'

// TEMPORAL — stub del spike T0. Se reemplaza por el handler real en T5.
// Captura el payload crudo del webhook de MercadoPago para resolver
// los literales de type/action (P1) y la presencia de query params.
//
// Deliberadamente NO valida con Zod: el payload crudo es justamente lo
// que hay que descobrir (P1). Un schema asumido invalidaria el spike.

const logger = createLogger('spike-t0-stub')

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const headers = Object.fromEntries(request.headers.entries())
  const url = new URL(request.url)

  const capture = {
    timestamp: new Date().toISOString(),
    url: request.url,
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
    rawBody,
    parsed: (() => {
      try {
        return JSON.parse(rawBody)
      } catch {
        return null
      }
    })(),
  }

  const dir = await resolveCaptureDir()
  const filename = `${Date.now()}-${capture.parsed?.type ?? 'unknown'}-${capture.parsed?.action ?? 'noaction'}.json`
  await writeFile(join(dir, filename), JSON.stringify(capture, null, 2))

  logger.info(
    { filename, dir, type: capture.parsed?.type, action: capture.parsed?.action },
    'Webhook captured',
  )
  // Only structural metadata in logs: the full payload (and any signature
  // header) stays in the capture file, never in the log stream.
  logger.info(
    { query: capture.query, hasSignature: 'x-signature' in headers },
    'Webhook envelope',
  )

  return NextResponse.json({ received: true, captured: filename })
}

// Vercel: /tmp is the only writable path (ephemeral — read via logs).
// Local: /tmp may not exist on Windows, so fall back to .t0-captures/ in cwd.
async function resolveCaptureDir(): Promise<string> {
  const candidates = [
    join('/tmp', 'webhook-captures'),
    join(process.cwd(), '.t0-captures'),
  ]
  for (const dir of candidates) {
    try {
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, '.probe'), 'ok')
      return dir
    } catch {
      // next candidate
    }
  }
  return candidates[candidates.length - 1]
}

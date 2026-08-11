import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@repo/db'
import { createLogger } from '@repo/logger'
import { redisPing } from './redis'

const CHECK_TIMEOUT_MS = 4000

const logger = createLogger('health')

export interface HealthCheckHandlerConfig {
  appName: string
  hasRedis?: boolean
}

type CheckStatus = 'ok' | 'error' | 'skipped' | 'missing'

function timeoutPromise(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () =>
        reject(new Error(`Health check timed out after ${CHECK_TIMEOUT_MS}ms`)),
      CHECK_TIMEOUT_MS,
    )
  })
}

async function withTimeout<T>(check: () => Promise<T>): Promise<T> {
  return await Promise.race([check(), timeoutPromise()])
}

async function checkDb(): Promise<CheckStatus> {
  try {
    await withTimeout(async () => {
      await db.execute(sql`SELECT 1`)
    })
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkRedis(hasRedis: boolean): Promise<CheckStatus> {
  if (!hasRedis) return 'skipped'
  if (!process.env.REDIS_URL) return 'skipped'
  try {
    const alive = await withTimeout(async () => redisPing())
    return alive ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

function checkMercadoPago(): CheckStatus {
  return process.env.MERCADOPAGO_ACCESS_TOKEN ? 'ok' : 'missing'
}

export function createHealthCheckHandler(config: HealthCheckHandlerConfig) {
  const { appName, hasRedis = false } = config

  return async function GET() {
    const timestamp = new Date().toISOString()

    const checks = {
      db: await checkDb(),
      redis: await checkRedis(hasRedis),
      mercadopago: checkMercadoPago(),
    }

    const degraded = Object.values(checks).some(
      (status) => status === 'error' || status === 'missing',
    )

    if (degraded) {
      logger.warn({ app: appName, checks }, 'Health check degraded')
      try {
        const { captureMessage } = await import('@sentry/nextjs')
        if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
          captureMessage(`Health check degraded (${appName})`, {
            level: 'warning',
            extra: { checks, timestamp },
          })
        }
      } catch {
        // Sentry no disponible: la degradación ya quedó logueada.
      }
    }

    return NextResponse.json(
      { status: degraded ? 'degraded' : 'ok', checks, app: appName, timestamp },
      { status: degraded ? 503 : 200 },
    )
  }
}

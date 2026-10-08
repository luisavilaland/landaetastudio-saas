import { NextResponse } from 'next/server'
import { redisDel, redisIncr, redisPexpire } from '@repo/commerce'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-subscriptions-api')

/**
 * Piezas compartidas por los 6 endpoints de suscripciones (Fase 2 / T4).
 *
 * Consolidar esto evita duplicar el patron de auth + errores en 6 handlers.
 */

/** Token de plataforma. El del tenant va cifrado en `tenant_mp_config`. */
export function getPlatformToken(): string | null {
  return process.env.MP_PLATFORM_ACCESS_TOKEN ?? null
}

/**
 * Resuelve `tenantId` y `email` desde el JWT.
 *
 * El `tenantId` sale SIEMPRE de la sesion, nunca del body ni del query: un
 * tenant no puede operar sobre la suscripcion de otro.
 *
 * El `email` tambien sale de la sesion y NO de un header del request. Ese dato
 * viaja a MercadoPago como `payer.email`; tomarlo del cliente permitiria
 * mandar el cobro de un tenant a una casilla arbitraria.
 *
 * @returns el contexto de sesion, o una `NextResponse` de error lista para
 *          devolver.
 */
export async function requireAuthContext(): Promise<
  { tenantId: string; email: string | null } | NextResponse<{ error: string }>
> {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const tenantId = session.user?.tenantId
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant no encontrado' },
      { status: 400 },
    )
  }

  return { tenantId, email: session.user?.email ?? null }
}

/**
 * Resuelve solo el `tenantId`. Atajo para los endpoints que no necesitan el
 * email del pagador.
 */
export async function requireTenantId(): Promise<
  string | NextResponse<{ error: string }>
> {
  const ctx = await requireAuthContext()
  return ctx instanceof NextResponse ? ctx : ctx.tenantId
}

/** 400 con el campo que fallo, para que el form pueda resaltar (AGENTS.md). */
export function validationError(message: string, field: string) {
  return NextResponse.json({ error: message, field }, { status: 400 })
}

/** 404 con `field` opcional. */
export function notFoundError(message: string, field?: string) {
  return NextResponse.json(
    field ? { error: message, field } : { error: message },
    { status: 404 },
  )
}

/**
 * 409 con `field`: el estado actual no permite la operacion.
 * El body incluye el estado para que la UI pueda explicar por que.
 */
export function conflictError(
  message: string,
  field: string,
  status?: string,
  permissions?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: message, field, ...(status ? { status } : {}), ...(permissions ?? {}) },
    { status: 409 },
  )
}

/**
 * 502 cuando MercadoPago responde con error.
 *
 * Se distingue del 500 a proposito: un 502 es reintentable por el cliente
 * porque nuestra app esta bien y el de MercadoPago esta caido.
 */
export function mpError(message: string, detail?: unknown) {
  return NextResponse.json(
    { error: message, ...(detail ? { detail } : {}) },
    { status: 502 },
  )
}

/** 500 para fallos nuestros. */
export function serverError(message: string, err: unknown) {
  logger.error({ err }, message)
  return NextResponse.json({ error: message }, { status: 500 })
}

const RATE_LIMIT_WINDOW_MS = 60_000

/**
 * Rate limit por IP, fail-open.
 *
 * AGENTS.md: si Redis cae se degrada (permite el request) en vez de devolver
 * 500. Un rate limit es proteccion, no funcionalidad critica: bloquear el alta de
 * suscripciones porque Redis esta caido seria peor que la falta de rate limit.
 *
 * @returns `true` si se permite el request, `false` si se rechazo por limite.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
): Promise<boolean> {
  const redisKey = `rate_limit:${key}`

  try {
    const count = await redisIncr(redisKey)

    // null = Redis caido (fail-open).
    if (count === null) {
      logger.warn({ key: redisKey }, 'Rate limit: Redis no disponible, fail-open')
      return true
    }

    if (count === 1) {
      const ttlApplied = await redisPexpire(redisKey, RATE_LIMIT_WINDOW_MS)
      if (!ttlApplied) {
        // Item 66 (H-F2-7): sin TTL la clave sobrevive para siempre, el contador
        // sigue subiendo y se llega a un 429 que no se recupera nunca.
        //
        // Ojo con lo que NO alcanza: log + fail-open aqui deja pasar ESTE
        // request pero no deshace nada, porque `count === 1` no se va a repetir
        // y nadie reintenta el TTL. Por eso se borra la clave: el siguiente
        // request vuelve a ver `count === 1` y reintenta. La degradacion es que
        // el rate limit puede no aplicarse, en vez de bloquear al tenant para
        // siempre — eso es fail-open de verdad.
        logger.warn(
          { key: redisKey },
          'Rate limit: no se pudo fijar el TTL, se reintenta en el proximo request',
        )
        await redisDel(redisKey)
      }
    }

    if (count > limit) {
      return false
    }

    return true
  } catch (err) {
    logger.warn({ err, key: redisKey }, 'Rate limit fallo, fail-open')
    return true
  }
}

/** IP del cliente, para la clave de rate limit. */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
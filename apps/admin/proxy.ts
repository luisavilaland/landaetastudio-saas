import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { eq } from 'drizzle-orm'
import { captureException } from '@sentry/nextjs'
import {
  dbSubscriptions,
  dbTenants,
  withTenantContext,
} from '@repo/db'
import { ADMIN_SESSION_COOKIE_NAME } from '@repo/auth/session-cookie'
import { createLogger } from '@/lib/logger'
import { decidePanelAccess } from '@/lib/panel-access'

const logger = createLogger('admin-proxy')

/**
 * S4d: `canAccessPanel` se impone, no solo se informa.
 *
 * Antes de este archivo el unico lector de la matriz de permisos era la
 * respuesta de `GET /api/subscriptions`: un tenant `suspended` recibia
 * `canAccessPanel: 'none'` en un JSON y el cliente podia ignorarlo. Era el item
 * 61 aplicado a la autorizacion: un control que acompana y no verifica.
 *
 * Reglas (issue #254, decision de producto de Luis):
 * - `suspended` es un **bloqueo de plataforma**, no una deuda: no entra.
 * - `expired`, `abandoned`, `cancelled`, `pending_first_payment` dejan pasar en
 *   `readonly`: ver es menos malo que no ver, y el onboarding exige configurar
 *   antes de pagar (item 96).
 *
 * La decision **no** se reimplementa aca: sale de `deriveTenantPermissions`
 * (`@repo/commerce`), que es la misma matriz que consume el endpoint. Si el
 * estado es desconocido, esa funcion lanza y este proxy responde 503.
 *
 * `canWrite` / `canPublish` **no** se aplican aca. Este archivo es solo el
 * acceso; bloquear la escritura es S4c, en los endpoints.
 */

export const config = {
  // Exclusiones, todas con motivo y **ancladas**:
  // - `_next` y `favicon.ico`: assets del framework.
  // - `api/auth`: callbacks de NextAuth; sin esto no se puede ni iniciar sesion.
  // - `api/health`: health check publico (monitoreo, sin sesion).
  // - `api/webhooks`: MercadoPago no manda cookie de sesion. Si el webhook
  //   pasara por el gate, el pago se cobraria y la orden no se confirmaria.
  //   AGENTS.md: el webhook de plataforma vive en admin y es privado por firma,
  //   no por sesion.
  // - `suspended` y `login`: la pagina de destino y la de entrada. Sin esto el
  //   redirect rebota contra si mismo.
  //
  // El `(?:/|$)` de cada prefijo es lo que hace la diferencia: con `login` a
  // secas, `/login-historial` tambien quedaba fuera del gate por coincidencia
  // de prefijo. La exclusion tiene que ser del arbol de la ruta, no del texto.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|suspended(?:/|$)|login(?:/|$)|api/auth(?:/|$)|api/health(?:/|$)|api/webhooks(?:/|$)).*)',
  ],
}

interface PanelRow {
  tenantStatus: string | null
  subscriptionStatus: string | null
}

/**
 * Una sola transaccion por request: resuelve `tenantId` desde el JWT, lo mete
 * en el contexto RLS y lee las dos columnas que gobiernan el acceso.
 *
 * **Costo**: es una query en el camino caliente de cada request y de cada
 * prefetch. Se acepta porque el dato no se puede cachear sin arriesgar dejar
 * fuera a un tenant que acaba de ser suspendido; queda medido y reportado.
 */
async function loadPanelRow(tenantId: string): Promise<PanelRow | null> {
  const rows = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({
        tenantStatus: dbTenants.status,
        subscriptionStatus: dbSubscriptions.status,
      })
      .from(dbTenants)
      .leftJoin(dbSubscriptions, eq(dbSubscriptions.tenantId, dbTenants.id))
      .where(eq(dbTenants.id, tenantId))
      .limit(1),
  )

  return rows[0] ?? null
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

/**
 * Respuesta para un tenant bloqueado.
 *
 * Un `redirect` a `/suspended` en una ruta de API le devuelve HTML al `fetch`
 * del cliente, que lo interpreta como un error de parseo en vez de como "no
 * tenes acceso". La pagina redirige; la API responde 403 con `field`, igual que
 * el resto de la app.
 */
function blocked(request: NextRequest): NextResponse {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      {
        error: 'Tu cuenta esta suspendida. Contacta al soporte.',
        field: 'account',
      },
      { status: 403 },
    )
  }

  const url = request.nextUrl.clone()
  url.pathname = '/suspended'
  url.search = ''
  return NextResponse.redirect(url)
}

/**
 * No se pudo decidir: no es "no podes", es "no sabemos".
 *
 * Distinguirlo importa. Un 403/redirect afirmaria que el tenant no tiene
 * permiso; un 503 dice la verdad: la decision fallo y el estado del tenant no se
 * puede afirmar. `fail-closed` aca es 503, no acceso libre.
 */
function unavailable(request: NextRequest, reason: string): NextResponse {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'No se pudo verificar el estado de la cuenta' },
      { status: 503 },
    )
  }

  return new NextResponse('No se pudo verificar el estado de la cuenta', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // El `salt` del JWE **es** el nombre de la cookie (ver session-cookie.ts).
    salt: ADMIN_SESSION_COOKIE_NAME,
    cookieName: ADMIN_SESSION_COOKIE_NAME,
    secureCookie: ADMIN_SESSION_COOKIE_NAME.startsWith('__Secure-'),
  })

  const tenantId = typeof token?.tenantId === 'string' ? token.tenantId : null

  // Sin sesion no hay tenant que gobernar. No es un bypass del gate: lo que
  // queda detras es lo que ya depende de `auth()` para servir datos, y las
  // rutas de API ya responden 401 por si mismas.
  //
  // Los headers de decision se borran aunque no haya sesion: si el cliente los
  // manda a mano y el proxy devolviera la request sin tocarlos, cualquier
  // handler que confie en `x-panel-access` leeria un valor escrito por el
  // cliente. Ausente y "no hay sesion" tienen que ser lo mismo.
  if (!tenantId) {
    const anonymousHeaders = new Headers(request.headers)
    anonymousHeaders.delete('x-panel-access')
    anonymousHeaders.delete('x-tenant-status')
    return NextResponse.next({ request: { headers: anonymousHeaders } })
  }

  try {
    const row = await loadPanelRow(tenantId)

    if (!row) {
      logger.error(
        { tenantId },
        'Panel access: tenant row not found for authenticated session',
      )
      captureException(
        new Error('Panel access: tenant row not found for authenticated session'),
      )
      return unavailable(request, 'missing_tenant')
    }

    const decision = decidePanelAccess(row)

    if (decision.reason === 'missing_subscription') {
      // El acceso puede ser `readonly` (tenant active sin cobro) o `none`
      // (tenant suspendido sin cobro). Se loggea el resultado, no una suposicion.
      logger.warn(
        { tenantId, access: decision.access, tenantStatus: decision.tenantStatus },
        'Panel access: tenant has no subscription row',
      )
    }

    if (decision.access === 'none') {
      logger.info(
        {
          tenantId,
          reason: decision.reason,
          tenantStatus: decision.tenantStatus,
          subscriptionStatus: decision.subscriptionStatus,
        },
        'Panel access denied',
      )
      return blocked(request)
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-panel-access', decision.access)
    requestHeaders.set('x-tenant-status', decision.tenantStatus)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('x-panel-access', decision.access)
    response.headers.set('x-tenant-status', decision.tenantStatus)
    return response
  } catch (err) {
    // `deriveTenantPermissions` lanza con un estado desconocido: fail-closed.
    logger.error({ err, tenantId }, 'Panel access could not be derived')
    captureException(err)
    return unavailable(request, 'derive_failed')
  }
}

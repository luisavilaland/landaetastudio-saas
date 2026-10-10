import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@repo/db'
import { dbTenants } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('storefront-proxy')

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

const CART_COOKIE_NAME = 'cart_session_id'

/**
 * Un tenant solo se sirve si esta `active`.
 *
 * El enum `tenants_status` (migracion `0003`) tiene cuatro valores y solo este
 * opera la tienda. Sin este filtro, la migracion habria sido cosmetica: el
 * campo existiria, Drizzle lo tiparia, y el proxy resolveria igual un tenant
 * `pending` o `cancelled`.
 *
 * Los tenants que hoy no estan `active` (ninguno: los 3 son `active`) no
 * perderian su tienda con este filtro, pero cuando exista el onboarding -que
 * crea tenants en `pending` hasta que el webhook de plataforma confirma el
 * pago- ese estado es justamente el que este filtro protege.
 */
const ACTIVE_STATUS = 'active' as const

function getOrCreateSessionId(request: NextRequest): string {
  const cookie = request.cookies.get(CART_COOKIE_NAME)
  if (cookie?.value) return cookie.value
  return crypto.randomUUID()
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hostname = (request.headers.get('host') ?? '').replace(/:\d+$/, '')

  logger.debug({ hostname, pathname }, 'Proxy request')

  // 0. Host de plataforma: superficie del SaaS, no de una tienda.
  //
  // D1 del design de Fase 3. Sin esta salida, el dominio de la plataforma
  // caeria en el paso 5 y devolveria 404, porque no hay tenant que resolver.
  //
  // Va **antes de todo**, no solo antes de los fallbacks. Si fuera despues, un
  // `tenant-slug` de una visita anterior a una tienda resolveria un tenant en el
  // host de plataforma y la landing mostraria esa tienda. El host de plataforma
  // no tiene tenant por definicion, asi que no se intenta resolver ninguno.
  //
  // Esto tambien reserva el host de plataforma como `customDomain`: si se
  // llegara aqui con un tenant que lo reclama, la peticion va a la landing y no
  // a su tienda, que es el resultado correcto.
  if (process.env.PLATFORM_HOST && hostname === process.env.PLATFORM_HOST) {
    logger.debug({ hostname, pathname }, 'Platform host - no tenant resolution')
    return NextResponse.next()
  }

  let tenantSlug: string | null = null
  let tenantId: string | null = null

  // 1. Intentar resolver por dominio custom
  if (hostname && hostname.includes('.') && !hostname.startsWith('localhost')) {
    try {
      const byDomain = await db
        .select({ slug: dbTenants.slug, id: dbTenants.id })
        .from(dbTenants)
        .where(
          and(
            eq(dbTenants.customDomain, hostname),
            eq(dbTenants.status, ACTIVE_STATUS),
          ),
        )
        .limit(1)

      if (byDomain.length > 0) {
        tenantSlug = byDomain[0].slug
        tenantId = byDomain[0].id
        logger.info(
          { hostname, tenantSlug, tenantId },
          'Resolved by customDomain',
        )
      }
    } catch (e) {
      logger.error({ hostname, error: e }, 'Error resolving customDomain')
    }

    // 2. Intentar resolver por subdominio
    if (!tenantSlug) {
      const sub = hostname.split('.')[0]
      try {
        const bySlug = await db
          .select({ slug: dbTenants.slug, id: dbTenants.id })
          .from(dbTenants)
          .where(
            and(eq(dbTenants.slug, sub), eq(dbTenants.status, ACTIVE_STATUS)),
          )
          .limit(1)

        if (bySlug.length > 0) {
          tenantSlug = bySlug[0].slug
          tenantId = bySlug[0].id
        }
      } catch (e) {
        logger.error({ hostname, sub, error: e }, 'Error resolving subdomain')
      }
    }
  }

  // 3. Cookie de tenant.
  //
  // A diferencia de 1 y 2, este valor **lo elige el cliente**: la cookie la
  // manda el navegador. Por eso se valida contra la base SIEMPRE, sin
  // importar el entorno.
  //
  // Sin el filtro de status, un tenant `pending` o `cancelled` seguiria
  // resolviendo por cookie aunque los lookups por host lo filtraran. Y un
  // slug inventado en la cookie resolveria un tenant que existe pero que
  // el visitante no navego.
  //
  // Ademas consulta la base, asi que tambien obtiene `tenantId`: antes el
  // camino 3 dejaba `tenantId` en null y el header `x-tenant-id` no se
  // seteaba. Ese header es lo que despues usan las queries con RLS.
  if (!tenantSlug) {
    const tenantCookie = request.cookies.get('tenant-slug')
    if (tenantCookie?.value) {
      try {
        const byCookie = await db
          .select({ slug: dbTenants.slug, id: dbTenants.id })
          .from(dbTenants)
          .where(
            and(
              eq(dbTenants.slug, tenantCookie.value),
              eq(dbTenants.status, ACTIVE_STATUS),
            ),
          )
          .limit(1)

        if (byCookie.length > 0) {
          tenantSlug = byCookie[0].slug
          tenantId = byCookie[0].id
        } else {
          logger.debug(
            { slug: tenantCookie.value },
            'Tenant cookie did not resolve to an active tenant - ignored',
          )
        }
      } catch (e) {
        logger.error({ error: e }, 'Error resolving tenant cookie')
      }
    }
  }

  // 4 y 4b. Fallbacks de desarrollo.
  //
  // Van gateados por `ENABLE_DEFAULT_TENANT_FALLBACK`, no por `NODE_ENV`.
  // La razon: **Preview de Vercel no es development ni production**, es un
  // tercer estado. `NODE_ENV === 'development'` es una suposicion sobre cual
  // entorno es, y una suposicion que en Preview es falsa: dejaria el fallback
  // apagado donde hace falta y nadie tendria un error que explicar.
  // Una env var explicita la decide el humano y queda en el audit trail.
  //
  // Estos dos **no se validan contra la base**: no son input del cliente, son
  // configuracion del operador. Validarlos seria mas raro que eliminarlos:
  // en un entorno donde no deberian existir, directamente no existen.
  const devFallbackEnabled =
    process.env.ENABLE_DEFAULT_TENANT_FALLBACK === 'true'

  if (!tenantSlug && devFallbackEnabled && hostname.startsWith('localhost')) {
    tenantSlug = 'tienda1'
    logger.debug({ hostname, tenantSlug }, 'Using default tenant for localhost')
  }

  if (!tenantSlug && devFallbackEnabled && process.env.DEFAULT_TENANT_SLUG) {
    tenantSlug = process.env.DEFAULT_TENANT_SLUG
    logger.debug({ hostname, tenantSlug }, 'Using DEFAULT_TENANT_SLUG')
  }

  // 5. Si no se resolvió ningún tenant, devolver 404
  if (!tenantSlug) {
    logger.warn({ hostname }, 'No tenant resolved')
    return new NextResponse('Not Found', { status: 404 })
  }

  const sessionId = getOrCreateSessionId(request)

  // Clonar el request con los headers nuevos
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-slug', tenantSlug)
  if (tenantId) requestHeaders.set('x-tenant-id', tenantId)
  requestHeaders.set('x-cart-session-id', sessionId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Pasar headers al response también para cookies
  response.headers.set('x-tenant-slug', tenantSlug)
  if (tenantId) response.headers.set('x-tenant-id', tenantId)

  // Setear cookie de sesión si es nueva
  if (!request.cookies.get(CART_COOKIE_NAME)) {
    response.cookies.set(CART_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    })
  }

  logger.debug({ tenantSlug, sessionId }, 'Proxy resolved')
  return response
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@repo/db';
import { dbTenants } from '@repo/db';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const logger = createLogger('storefront-proxy');

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

const CART_COOKIE_NAME = 'cart_session_id';

function getOrCreateSessionId(request: NextRequest): string {
  const cookie = request.cookies.get(CART_COOKIE_NAME);
  if (cookie?.value) return cookie.value;
  return crypto.randomUUID();
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = (request.headers.get('host') ?? '').replace(/:\d+$/, '');

  logger.debug({ hostname, pathname }, 'Proxy request');

  let tenantSlug: string | null = null;
  let tenantId: string | null = null;

  // 1. Intentar resolver por dominio custom
  if (hostname && hostname.includes('.') && !hostname.startsWith('localhost')) {
    try {
      const byDomain = await db
        .select({ slug: dbTenants.slug, id: dbTenants.id })
        .from(dbTenants)
        .where(eq(dbTenants.customDomain, hostname))
        .limit(1);

      if (byDomain.length > 0) {
        tenantSlug = byDomain[0].slug;
        tenantId = byDomain[0].id;
        logger.info({ hostname, tenantSlug, tenantId }, 'Resolved by customDomain');
      }
    } catch (e) {
      logger.error({ hostname, error: e }, 'Error resolving customDomain');
    }

    // 2. Intentar resolver por subdominio
    if (!tenantSlug) {
      const sub = hostname.split('.')[0];
      try {
        const bySlug = await db
          .select({ slug: dbTenants.slug, id: dbTenants.id })
          .from(dbTenants)
          .where(eq(dbTenants.slug, sub))
          .limit(1);

        if (bySlug.length > 0) {
          tenantSlug = bySlug[0].slug;
          tenantId = bySlug[0].id;
        }
      } catch (e) {
        logger.error({ hostname, sub, error: e }, 'Error resolving subdomain');
      }
    }
  }

  // 3. Fallback: cookie de tenant
  if (!tenantSlug) {
    const tenantCookie = request.cookies.get('tenant-slug');
    if (tenantCookie?.value) {
      tenantSlug = tenantCookie.value;
    }
  }

  // 4. Fallback para localhost (desarrollo): usar tenant por defecto
  if (!tenantSlug && hostname.startsWith('localhost')) {
    tenantSlug = 'tienda1';
    logger.debug({ hostname, tenantSlug }, 'Using default tenant for localhost');
  }

  // 5. Si no se resolvió ningún tenant, devolver 404
  if (!tenantSlug) {
    logger.warn({ hostname }, 'No tenant resolved');
    return new NextResponse('Not Found', { status: 404 });
  }

  const sessionId = getOrCreateSessionId(request);

  // Clonar el request con los headers nuevos
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', tenantSlug);
  if (tenantId) requestHeaders.set('x-tenant-id', tenantId);
  requestHeaders.set('x-cart-session-id', sessionId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Pasar headers al response también para cookies
  response.headers.set('x-tenant-slug', tenantSlug);
  if (tenantId) response.headers.set('x-tenant-id', tenantId);

  // Setear cookie de sesión si es nueva
  if (!request.cookies.get(CART_COOKIE_NAME)) {
    response.cookies.set(CART_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });
  }

  logger.debug({ tenantSlug, sessionId }, 'Proxy resolved');
  return response;
}

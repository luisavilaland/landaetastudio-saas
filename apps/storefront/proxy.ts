import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@repo/db';
import { dbTenants } from '@repo/db';
import { eq } from 'drizzle-orm';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
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

  console.log('[Proxy] Hostname:', hostname, '| Path:', pathname);

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
        console.log('[Proxy] Resolved by customDomain:', hostname, '->', tenantSlug);
      }
    } catch (e) {
      console.error('[Proxy] Error resolving customDomain:', e);
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
        console.error('[Proxy] Error resolving subdomain:', e);
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

  // 4. Fallback final: default
  if (!tenantSlug) {
    tenantSlug = 'default';
    console.log('[Proxy] Sin tenant resuelto, usando default');
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

  console.log('[Proxy] Tenant Slug:', tenantSlug, '| Session:', sessionId);
  return response;
}

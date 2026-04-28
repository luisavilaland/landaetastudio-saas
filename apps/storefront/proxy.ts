import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: '/:path*',
};

const CART_COOKIE_NAME = 'cart_session_id';

function getOrCreateSessionId(request: NextRequest, response: NextResponse): string {
  const cookie = request.cookies.get(CART_COOKIE_NAME);
  if (cookie?.value) {
    return cookie.value;
  }

  const newSessionId = crypto.randomUUID();
  response.cookies.set({
    name: CART_COOKIE_NAME,
    value: newSessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return newSessionId;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = (request.headers.get('host') ?? '').replace(/:\d+$/, '');
  const headerTenantSlug = request.headers.get('x-tenant-slug');

  console.log('[Proxy] Hostname:', hostname, '| Header slug:', headerTenantSlug, '| Path:', pathname);

  // Rutas públicas que no requieren tenant
  const publicPaths = ['/login', '/register', '/api/auth'];
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'));

  let tenantSlug: string | null = null;

  // Priorizar header x-tenant-slug si viene en la petición
  if (headerTenantSlug && headerTenantSlug.trim() !== '') {
    tenantSlug = headerTenantSlug.trim();
  }
  // Si no viene en el header, intentar resolver desde subdominio
  else if (hostname && hostname.includes('.') && !hostname.startsWith('localhost')) {
    tenantSlug = hostname.split('.')[0];
  }
  // Si no, intentar desde cookie (para after logout redirect)
  else {
    const tenantCookie = request.cookies.get('tenant-slug');
    if (tenantCookie?.value) {
      tenantSlug = tenantCookie.value;
    }
  }

  // Si no se pudo resolver el tenant y no es ruta pública, devolver 400
  if (!tenantSlug) {
    if (isPublicPath) {
      console.log('[Proxy] Ruta pública sin tenant, continuando sin slug');
      const response = NextResponse.next();
      const sessionId = getOrCreateSessionId(request, response);
      response.headers.set('x-cart-session-id', sessionId);
      return response;
    }
    console.log('[Proxy] No se pudo resolver tenant slug');
    return new NextResponse(
      JSON.stringify({ error: 'Tenant no encontrado. Usa header x-tenant-slug o subdominio.' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  console.log('[Proxy] Tenant Slug resuelto:', tenantSlug);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', tenantSlug);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('x-tenant-slug', tenantSlug);

  const sessionId = getOrCreateSessionId(request, response);
  response.headers.set('x-cart-session-id', sessionId);

  return response;
}
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

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') ?? '').replace(/:\d+$/, '');

  console.log('[Proxy] Hostname:', hostname);

  let tenantSlug = 'default';

  if (hostname && hostname.includes('.') && !hostname.startsWith('localhost')) {
    tenantSlug = hostname.split('.')[0];
  }

  console.log('[Proxy] Tenant Slug:', tenantSlug);

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
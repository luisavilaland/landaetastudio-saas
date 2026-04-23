import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: '/:path*',
};

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') ?? '').replace(/:\d+$/, '');
  
  console.log('[Middleware] Hostname:', hostname);

  let tenantSlug = 'default';

  if (hostname && hostname.includes('.') && !hostname.startsWith('localhost')) {
    tenantSlug = hostname.split('.')[0];
  }

  console.log('[Middleware] Tenant Slug:', tenantSlug);

  if (tenantSlug === 'default') {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', tenantSlug);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('x-tenant-slug', tenantSlug);

  return response;
}
import { NextResponse } from 'next/server';

const customerDomains = new Set(['ifixlab251.com', 'www.ifixlab251.com']);

export function proxy(request) {
  const hostname = request.headers.get('host')?.split(':')[0].toLowerCase();
  const isCustomerDomain = customerDomains.has(hostname);

  if (request.nextUrl.pathname === '/' && isCustomerDomain) {
    return NextResponse.rewrite(new URL('/customer', request.url));
  }

  if (request.nextUrl.pathname === '/staff' && isCustomerDomain) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/', '/staff'] };

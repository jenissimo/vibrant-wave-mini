import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 proxy (replaces deprecated middleware).
 * Protects routes when AUTH_ENABLED=true; redirects unauthenticated users to /login.
 */
export async function proxy(request: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED === 'true';

  if (!authEnabled) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
};

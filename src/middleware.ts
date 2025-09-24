import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const authEnabled = process.env.AUTH_ENABLED === 'true';
    
    // If auth is disabled, allow all requests
    if (!authEnabled) {
      return NextResponse.next();
    }

    // If auth is enabled but user is not authenticated, redirect to login
    if (!req.nextauth.token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const authEnabled = process.env.AUTH_ENABLED === 'true';
        
        // If auth is disabled, always allow
        if (!authEnabled) {
          return true;
        }

        // If auth is enabled, check if user is authenticated
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)',
  ],
};

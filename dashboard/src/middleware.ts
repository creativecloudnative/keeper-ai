import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';

export default auth((req: NextAuthRequest) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === '/login';

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  // Exclude Next.js internals, auth routes, and any public static files (extensions)
  matcher: ['/((?!_next/static|_next/image|api/auth|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|woff2?|ttf|otf|css|js)$).*)'],
};

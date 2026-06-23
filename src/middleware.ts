import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mirror the bypass used by requireAdmin() so dev/test (ADMIN_AUTH_DISABLED)
// and the page gate behave identically.
const AUTH_DISABLED = process.env.ADMIN_AUTH_DISABLED === 'true';

// Gate the /admin page: unauthenticated visits are redirected to the OIDC
// sign-in flow. The /api/admin/* routes are NOT matched here — they guard
// themselves via requireAdmin() so they can return JSON 401/403 to fetch()
// instead of an HTML redirect.
const protectedMiddleware = withAuth({
  callbacks: {
    authorized: ({ token }) => !!token?.email,
  },
});

export default function middleware(req: NextRequest, event: any) {
  if (AUTH_DISABLED) {
    return NextResponse.next();
  }
  // withAuth augments the request with `nextauth` at runtime; the plain
  // NextRequest is accepted as-is.
  return (protectedMiddleware as any)(req, event);
}

export const config = {
  matcher: ['/admin/:path*'],
};

/**
 * OIDC authentication for the admin panel.
 *
 * Auth is enforced by default. It can be bypassed for local development and
 * the Playwright suite by setting ADMIN_AUTH_DISABLED=true (see middleware.ts
 * and requireAdmin() below).
 *
 * Configure a generic OpenID Connect identity provider (Authentik, Keycloak,
 * Auth0, Azure AD, Google, etc.) via:
 *   OIDC_ISSUER          - issuer URL (discovery doc lives at
 *                          <issuer>/.well-known/openid-configuration)
 *   OIDC_CLIENT_ID
 *   OIDC_CLIENT_SECRET
 *   OIDC_SCOPES          - optional, defaults to "openid email profile"
 *   OIDC_PROVIDER_NAME   - optional, display name on the sign-in button
 *   NEXTAUTH_SECRET      - required: secret used to sign the session JWT.
 *   NEXTAUTH_URL         - required in production: the canonical app URL.
 *
 * Authorization model: ANY user the IdP successfully authenticates is treated
 * as an admin. Restrict who can sign in at the IdP (e.g. scope the OIDC
 * application to an admin group) rather than in this app.
 */
import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export const AUTH_DISABLED = process.env.ADMIN_AUTH_DISABLED === 'true';

/** Whether the OIDC provider has the env it needs to function. */
export const AUTH_CONFIGURED = Boolean(
  process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  // No provider is registered when the env isn't set, so sign-in fails closed
  // rather than silently exposing the panel.
  providers: AUTH_CONFIGURED
    ? [
        {
          id: 'oidc',
          name: process.env.OIDC_PROVIDER_NAME || 'SSO',
          type: 'oauth',
          wellKnown: `${process.env.OIDC_ISSUER!.replace(/\/$/, '')}/.well-known/openid-configuration`,
          clientId: process.env.OIDC_CLIENT_ID,
          clientSecret: process.env.OIDC_CLIENT_SECRET,
          authorization: {
            params: { scope: process.env.OIDC_SCOPES || 'openid email profile' },
          },
          idToken: true,
          checks: ['pkce', 'state'],
          profile(profile: Record<string, any>) {
            return {
              id: profile.sub,
              name: profile.name ?? profile.preferred_username ?? profile.email,
              email: profile.email,
            };
          },
        },
      ]
    : [],
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
};

type AdminGuard =
  | { ok: true; email: string }
  | { ok: false; response: NextResponse };

/**
 * Guard for admin API route handlers. Returns the authenticated admin email,
 * or a ready-to-return JSON error response (401/403). Honours the
 * ADMIN_AUTH_DISABLED bypass so it mirrors the middleware exactly.
 */
export async function requireAdmin(): Promise<AdminGuard> {
  if (AUTH_DISABLED) {
    return { ok: true, email: 'auth-disabled@local' };
  }

  if (!AUTH_CONFIGURED) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Admin authentication is not configured on the server.' },
        { status: 503 }
      ),
    };
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true, email };
}

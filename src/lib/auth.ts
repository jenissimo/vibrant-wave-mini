import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { OAuthConfig } from 'next-auth/providers/oauth';

// OIDC profile interface
interface OIDCProfile {
  sub?: string;
  id?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
}

// Check if OIDC is configured
const isOIDCConfigured = () => {
  return !!(
    process.env.OIDC_ISSUER_URL &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET
  );
};

// Create OIDC provider configuration
const createOIDCProvider = (): OAuthConfig<OIDCProfile> => {
  const issuer = process.env.OIDC_ISSUER_URL!;
  return {
    id: 'oidc',
    name: 'OIDC',
    type: 'oauth',
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    issuer: issuer,
    clientId: process.env.OIDC_CLIENT_ID!,
    clientSecret: process.env.OIDC_CLIENT_SECRET!,
    checks: ['pkce', 'state'],
    idToken: true,
    authorization: {
      params: {
        scope: 'openid email profile',
      },
    },
    profile(profile: OIDCProfile) {
      return {
        id: profile.sub || profile.id || '',
        name: profile.name || profile.preferred_username || profile.email || '',
        email: profile.email || '',
        image: profile.picture,
      };
    },
  };
};

export const authOptions: NextAuthOptions = {
  providers: [
    ...(isOIDCConfigured()
      ? [createOIDCProvider()]
      : [
          CredentialsProvider({
            name: 'credentials',
            credentials: {
              username: { label: 'Username', type: 'text' },
              password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
              const authEnabled = process.env.AUTH_ENABLED === 'true';
              
              if (!authEnabled) {
                return { id: '1', name: 'Guest', email: 'guest@example.com' };
              }

              if (!credentials?.username || !credentials?.password) {
                return null;
              }

              const validUser = process.env.AUTH_USER;
              const validPassword = process.env.AUTH_PASSWORD;

              if (credentials.username === validUser && credentials.password === validPassword) {
                return { id: '1', name: validUser, email: `${validUser}@example.com` };
              }

              return null;
            }
          })
        ]),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);

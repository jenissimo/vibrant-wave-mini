import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
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

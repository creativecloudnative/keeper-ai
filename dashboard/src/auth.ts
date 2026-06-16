import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import LinkedIn from 'next-auth/providers/linkedin';
import Credentials from 'next-auth/providers/credentials';

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? 'keeper@creativecloudnative.com')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

const devProvider =
  process.env.NODE_ENV === 'development'
    ? [
        Credentials({
          name: 'Dev Login',
          credentials: {
            email: { label: 'Email', type: 'email', placeholder: 'dev@localhost' },
          },
          async authorize(credentials) {
            const email = credentials?.email as string | undefined;
            if (!email || !isAllowedEmail(email)) return null;
            return { id: `dev-${email}`, name: 'Dev User', email, image: null };
          },
        }),
      ]
    : [];

const config: NextAuthConfig = {
  providers: [
    LinkedIn({
      clientId: process.env.AUTH_LINKEDIN_ID!,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET!,
      authorization: { params: { scope: 'openid profile email' } },
    }),
    ...devProvider,
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async signIn({ profile, account }) {
      if (account?.type === 'credentials') return true; // dev: checked in authorize()
      return isAllowedEmail((profile as { email?: string })?.email);
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.picture = (profile as { picture?: string }).picture ?? token.picture;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.picture) session.user.image = token.picture as string;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

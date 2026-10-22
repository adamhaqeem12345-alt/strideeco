import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

export function authConfigured() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [GitHub({ authorization: { params: { scope: 'read:user' } } })],
  callbacks: {
    jwt({ token, account }) {
      if (account) token.sub = `${account.provider}:${account.providerAccountId}`;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? '';
      return session;
    },
  },
});

export async function getUser() {
  if (!authConfigured()) return null;
  const session = await auth();
  return session?.user?.id ? { userId: session.user.id } : null;
}

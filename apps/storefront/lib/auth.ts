import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "next-auth";
import { authorizeCustomer, resolveTenantId } from "@/lib/customer-auth";

interface StorefrontUser extends User {
  tenantId?: string | null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const tenantId = await resolveTenantId(request);
        if (!tenantId) {
          return null;
        }

        return authorizeCustomer(email, password, tenantId);
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        const storefrontUser = user as StorefrontUser;
        if (storefrontUser.tenantId) {
          token.tenantId = storefrontUser.tenantId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        if (token.tenantId) {
          (session.user as StorefrontUser).tenantId = token.tenantId as string;
        }
      }
      return session;
    }
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
});
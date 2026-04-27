import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, dbAdminUsers } from "@repo/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;
        const password = credentials.password as string;
        
        const [user] = await db
          .select()
          .from(dbAdminUsers)
          .where(eq(dbAdminUsers.email, email))
          .limit(1);
        
        if (!user) return null;
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;
        
        if (user.role !== "admin") {
          return null;
        }
        
        return {
          id: user.id,
          email: user.email,
          role: user.role ?? "admin",
          tenantId: user.tenantId ?? null
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId ?? null;
        token.role = user.role ?? "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.tenantId = token.tenantId ?? null;
        session.user.role = token.role ?? "admin";
      }
      return session;
    }
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
});
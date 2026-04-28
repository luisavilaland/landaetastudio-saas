import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "next-auth";
import { db, dbCustomers, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { getTenantId } from "@/lib/tenant";
import { NextResponse } from "next/server";

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find customer by email across all tenants
        // Customers can have same email in different tenants
        const [customer] = await db
          .select({
            id: dbCustomers.id,
            tenantId: dbCustomers.tenantId,
            email: dbCustomers.email,
            password: dbCustomers.password,
            name: dbCustomers.name,
          })
          .from(dbCustomers)
          .where(eq(dbCustomers.email, email))
          .limit(1);

        if (!customer || !customer.password) {
          return null;
        }

        // For login without tenant context (like after logout),
        // we need to set the tenant in the session
        // The middleware/proxy will need to handle this
        
        // Verify password
        const isValid = await bcrypt.compare(password, customer.password);
        if (!isValid) {
          return null;
        }

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name || undefined,
          tenantId: customer.tenantId,
        };
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
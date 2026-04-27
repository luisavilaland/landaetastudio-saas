import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, dbCustomers, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { getTenantId } from "@/lib/tenant";

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

        // Get tenant from header
        const headersList = await headers();
        const tenantSlug = headersList.get("x-tenant-slug");

        if (!tenantSlug) {
          console.log("[Storefront Auth] No tenant slug in header");
          return null;
        }

        const tenantId = await getTenantId(tenantSlug);
        if (!tenantId) {
          console.log("[Storefront Auth] Tenant not found:", tenantSlug);
          return null;
        }

        // Find customer by email first (unique per tenant)
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

        // Verify tenant matches (extra security)
        if (customer.tenantId !== tenantId) {
          console.log("[Storefront Auth] Customer belongs to different tenant");
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(password, customer.password);
        if (!isValid) {
          return null;
        }

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name || undefined,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    }
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
});
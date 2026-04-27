import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { Navbar } from "@/components/navbar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";

  let tenantName = "Mi Tienda";

  try {
    const result = await db
      .select({ name: dbTenants.name })
      .from(dbTenants)
      .where(eq(dbTenants.slug, tenantSlug))
      .limit(1);

    if (result.length > 0) {
      tenantName = result[0].name;
    }
  } catch {
    // ignore
  }

  return {
    title: tenantName,
    description: `Tienda online de ${tenantName}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";

  let tenantName = "Mi Tienda";

  try {
    const result = await db
      .select({ name: dbTenants.name })
      .from(dbTenants)
      .where(eq(dbTenants.slug, tenantSlug))
      .limit(1);

    if (result.length > 0) {
      tenantName = result[0].name;
    }
  } catch {
    // ignore
  }

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-zinc-50">
        <SessionProvider>
          <Navbar tenantName={tenantName} />
          <Breadcrumbs />
          <main className="flex-1">{children}</main>
          <footer className="bg-zinc-100 border-t border-zinc-200 px-6 py-4 mt-auto">
            <p className="text-center text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} {tenantName}
            </p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
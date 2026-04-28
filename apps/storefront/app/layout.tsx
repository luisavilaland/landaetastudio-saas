import type { Metadata } from "next";
import { headers } from "next/headers";
import Navbar from "@/components/navbar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SessionProvider } from "@/components/session-provider";
import { getCategoriesForTenant } from "@/lib/categories";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";

  let tenantName = "Mi Tienda";

  try {
    const { db, dbTenants } = await import("@repo/db");
    const { eq } = await import("drizzle-orm");

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
    const { db, dbTenants } = await import("@repo/db");
    const { eq } = await import("drizzle-orm");

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

  const categories = await getCategoriesForTenant(tenantSlug);

   return (
      <html lang="es">
        <body className="min-h-screen flex flex-col bg-zinc-50">
          <SessionProvider>
            <Navbar tenantName={tenantName} categories={categories} />
            <Breadcrumbs />
            <main className="flex-1">{children}</main>
            <footer className="bg-zinc-100 border-t border-zinc-200 px-6 py-4 mt-auto">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-zinc-500">
                  &copy; {new Date().getFullYear()} {tenantName}
                </p>
                <div className="flex items-center gap-4">
                  <a
                    href="/perfil"
                    className="text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    Sobre la tienda
                  </a>
                </div>
              </div>
            </footer>
          </SessionProvider>
        </body>
      </html>
    );
}
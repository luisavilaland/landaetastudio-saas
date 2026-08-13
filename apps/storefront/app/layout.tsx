import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Navbar from '@/components/navbar'
import { Breadcrumbs, BreadcrumbsProvider } from '@/components/breadcrumbs'
import { SessionProvider } from '@/components/session-provider'
import { getCategoriesForTenant } from '@/lib/categories'
import { validateEnv } from '@repo/validation'
import './globals.css'

validateEnv()

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-slug') || 'default'

  let tenantName = 'Mi Tienda'

  try {
    const { db, dbTenants } = await import('@repo/db')
    const { eq } = await import('drizzle-orm')

    const result = await db
      .select({ name: dbTenants.name })
      .from(dbTenants)
      .where(eq(dbTenants.slug, tenantSlug))
      .limit(1)

    if (result.length > 0) {
      tenantName = result[0].name
    }
  } catch {
    // ignore
  }

  return {
    title: tenantName,
    description: `Tienda online de ${tenantName}`,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-slug') || 'default'

  let tenantName = 'Mi Tienda'
  let tenantId: string | null = null
  let logoUrl: string | null = null
  let primaryColor = '#18181b'
  let secondaryColor = '#f4f4f5'
  let accentColor = '#ec4899'
  let fontFamily = 'system-ui, sans-serif'

  try {
    const { db, dbTenants } = await import('@repo/db')
    const { eq } = await import('drizzle-orm')

    const result = await db
      .select({
        id: dbTenants.id,
        name: dbTenants.name,
        settings: dbTenants.settings,
      })
      .from(dbTenants)
      .where(eq(dbTenants.slug, tenantSlug))
      .limit(1)

    if (result.length > 0) {
      tenantName = result[0].name
      tenantId = result[0].id
      const settings = (result[0].settings ?? {}) as {
        logoUrl?: string
        primaryColor?: string
        secondaryColor?: string
        accentColor?: string
        fontFamily?: string
      }
      logoUrl = settings.logoUrl ?? null
      if (settings.primaryColor) primaryColor = settings.primaryColor
      if (settings.secondaryColor) secondaryColor = settings.secondaryColor
      if (settings.accentColor) accentColor = settings.accentColor
      if (settings.fontFamily) fontFamily = settings.fontFamily
    }
  } catch {
    // ignore
  }

  const categories = tenantId ? await getCategoriesForTenant(tenantId) : []

  const themeStyle = {
    '--tenant-primary-color': primaryColor,
    '--tenant-secondary-color': secondaryColor,
    '--tenant-accent-color': accentColor,
    '--tenant-font-family': fontFamily,
  } as React.CSSProperties

  const dynamicStyles = `
    /* Override Tailwind palette with tenant colors */
    /* Primary: dark tones */
    .bg-zinc-900, .bg-zinc-800, .bg-zinc-700,
    .bg-slate-900, .bg-slate-800, .bg-slate-700,
    .bg-gray-900, .bg-gray-800, .bg-gray-700,
    .bg-stone-900, .bg-stone-800, .bg-stone-700,
    .bg-neutral-900, .bg-neutral-800, .bg-neutral-700 {
      background-color: var(--tenant-primary-color) !important;
    }
    .text-zinc-900, .text-zinc-800, .text-zinc-700,
    .text-slate-900, .text-slate-800, .text-slate-700,
    .text-gray-900, .text-gray-800, .text-gray-700,
    .text-stone-900, .text-stone-800, .text-stone-700,
    .text-neutral-900, .text-neutral-800, .text-neutral-700 {
      color: var(--tenant-primary-color) !important;
    }
    .border-zinc-900, .border-zinc-800, .border-zinc-700,
    .border-slate-900, .border-slate-800, .border-slate-700,
    .border-gray-900, .border-gray-800, .border-gray-700,
    .border-stone-900, .border-stone-800, .border-stone-700,
    .border-neutral-900, .border-neutral-800, .border-neutral-700 {
      border-color: var(--tenant-primary-color) !important;
    }
    /* Hover variants for primary */
    .hover\\:bg-zinc-900:hover, .hover\\:bg-zinc-800:hover, .hover\\:bg-zinc-700:hover,
    .hover\\:bg-zinc-900:hover, .hover\\:bg-zinc-800:hover {
      background-color: var(--tenant-primary-color) !important;
    }
    .hover\\:text-zinc-900:hover, .hover\\:text-zinc-800:hover, .hover\\:text-zinc-700:hover {
      color: var(--tenant-primary-color) !important;
    }

    /* Secondary: medium tones */
    .bg-zinc-600, .bg-zinc-500, .bg-zinc-400,
    .bg-slate-600, .bg-slate-500, .bg-slate-400,
    .bg-gray-600, .bg-gray-500, .bg-gray-400,
    .bg-stone-600, .bg-stone-500, .bg-stone-400,
    .bg-neutral-600, .bg-neutral-500, .bg-neutral-400 {
      background-color: var(--tenant-secondary-color) !important;
    }
    .text-zinc-600, .text-zinc-500, .text-zinc-400,
    .text-slate-600, .text-slate-500, .text-slate-400,
    .text-gray-600, .text-gray-500, .text-gray-400,
    .text-stone-600, .text-stone-500, .text-stone-400,
    .text-neutral-600, .text-neutral-500, .text-neutral-400 {
      color: var(--tenant-secondary-color) !important;
    }
    .border-zinc-600, .border-zinc-500, .border-zinc-400,
    .border-slate-600, .border-slate-500, .border-slate-400,
    .border-gray-600, .border-gray-500, .border-gray-400,
    .border-stone-600, .border-stone-500, .border-stone-400,
    .border-neutral-600, .border-neutral-500, .border-neutral-400 {
      border-color: var(--tenant-secondary-color) !important;
    }

    /* Accent: light tones */
    .bg-zinc-300, .bg-zinc-200, .bg-zinc-100,
    .bg-slate-300, .bg-slate-200, .bg-slate-100,
    .bg-gray-300, .bg-gray-200, .bg-gray-100,
    .bg-stone-300, .bg-stone-200, .bg-stone-100,
    .bg-neutral-300, .bg-neutral-200, .bg-neutral-100 {
      background-color: var(--tenant-accent-color) !important;
    }
    .text-zinc-300, .text-zinc-200, .text-zinc-100,
    .text-slate-300, .text-slate-200, .text-slate-100,
    .text-gray-300, .text-gray-200, .text-gray-100,
    .text-stone-300, .text-stone-200, .text-stone-100,
    .text-neutral-300, .text-neutral-200, .text-neutral-100 {
      color: var(--tenant-accent-color) !important;
    }

    /* Font family */
    body { font-family: var(--tenant-font-family, system-ui, sans-serif) !important; }
  `

  return (
    <html lang="es" style={themeStyle}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      </head>
      <body className="flex min-h-screen flex-col bg-zinc-50">
        <SessionProvider>
          <BreadcrumbsProvider>
            <Navbar
              tenantName={tenantName}
              logoUrl={logoUrl}
              categories={categories}
            />
            <Breadcrumbs />
            <main className="flex-1">{children}</main>
            <footer className="mt-auto border-t border-zinc-200 bg-zinc-100 px-6 py-4">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
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
          </BreadcrumbsProvider>
        </SessionProvider>
      </body>
    </html>
  )
}

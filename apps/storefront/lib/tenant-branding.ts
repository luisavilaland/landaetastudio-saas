import { db, dbTenants } from '@repo/db'
import { eq } from 'drizzle-orm'

/**
 * Branding del tenant para las superficies del storefront.
 *
 * T11 fix / H-F3-v2-1: el logo se escribe en `tenants."logoUrl"` y **no** en
 * `settings->>'logoUrl'`. Antes cada pagina hacia su propia query y cada una
 * leia el campo que se le ocurriera, asi que cambiar la fuente de verdad
 * obligaba a tocar N lugares y era facil olvidar uno.
 *
 * Este modulo es el unico lugar que sabe de donde sale el logo. Si manana el
 * branding crece (colores de marca, favicon), entra aqui y no en cada pagina.
 *
 * La columna `logoUrl` es la unica fuente de verdad desde la migracion 0005.
 * El campo `settings->>'logoUrl'` quedo deprecado: se sigue leyendo para el
 * resto de los ajustes (colores, contacto, redes), pero **el logo no sale de
 * ahi**.
 */
export interface TenantBranding {
  id: string
  name: string
  /** Columna `logoUrl`. Fuente de verdad. `null` cuando el tenant no tiene. */
  logoUrl: string | null
  /** Ajustes NO-branding: colores, contacto, redes, descripcion. */
  settings: {
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    fontFamily?: string
    storeDescription?: string
    contactEmail?: string
    contactPhone?: string
    socialLinks?: { instagram?: string; facebook?: string }
  }
}

const EMPTY: TenantBranding = {
  id: '',
  name: 'Mi Tienda',
  logoUrl: null,
  settings: {},
}

/**
 * Lee el branding del tenant por slug. `null` si no existe.
 *
 * NO captura errores a proposito: los callers decidiran. `layout.tsx` ya tiene
 * un `try/catch` con fallback a valores por defecto, y `perfil/page.tsx` el
 * suyo. Envolver aqui seria cambiarles el comportamiento sin avisar.
 */
export async function getTenantBrandingBySlug(
  slug: string,
): Promise<TenantBranding | null> {
  const rows = await db
    .select({
      id: dbTenants.id,
      name: dbTenants.name,
      logoUrl: dbTenants.logoUrl,
      settings: dbTenants.settings,
    })
    .from(dbTenants)
    .where(eq(dbTenants.slug, slug))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl ?? null,
    settings: (row.settings as TenantBranding['settings']) ?? {},
  }
}

export { EMPTY as EMPTY_BRANDING }
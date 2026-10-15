import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@repo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
  dbTenants: { id: 'id', name: 'name', logoUrl: 'logoUrl', settings: 'settings' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))

import { db } from '@repo/db'
import { getTenantBrandingBySlug } from '../tenant-branding'

function setupDb(rows: unknown[]) {
  ;(db as unknown as { limit: ReturnType<typeof vi.fn> }).limit = vi
    .fn()
    .mockResolvedValue(rows)
}

/**
 * T11 fix / H-F3-v2-1.
 *
 * Estas pruebas fijan **de donde sale el logo**. El bug era que cada pagina
 * hacia su propia query y leia el campo que se le ocurriera; despues T11
 * escribia en uno y el storefront leia el otro. Con el helper hay un solo
 * lugar, y estas pruebas son lo que lo sostienen.
 */
describe('getTenantBrandingBySlug — T11 fix', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toma el logo de la COLUMNA, no del jsonb', async () => {
    setupDb([
      {
        id: 't-1',
        name: 'Tienda 1',
        logoUrl: 'https://cdn.example.com/nuevo.png',
        // El jsonb todavia tiene el valor viejo. Si el helper leyera de ahi,
        // devolveria el viejo y esta prueba fallaria.
        settings: { logoUrl: 'https://cdn.example.com/viejo.png' },
      },
    ])

    const b = await getTenantBrandingBySlug('tienda1')

    expect(b?.logoUrl).toBe('https://cdn.example.com/nuevo.png')
  })

  it('devuelve null cuando el slug no existe', async () => {
    setupDb([])

    expect(await getTenantBrandingBySlug('no-existe')).toBeNull()
  })

  it('logoUrl null cuando el tenant no tiene logo', async () => {
    setupDb([{ id: 't-1', name: 'T', logoUrl: null, settings: {} }])

    const b = await getTenantBrandingBySlug('tienda1')

    expect(b?.logoUrl).toBeNull()
  })

  it('settings ausente se normaliza a objeto vacio, no a undefined', async () => {
    setupDb([{ id: 't-1', name: 'T', logoUrl: null, settings: null }])

    const b = await getTenantBrandingBySlug('tienda1')

    // Si fuera undefined, `branding.settings.primaryColor` reventaria en el
    // layout. El fallback a {} es lo que permite el acceso directo.
    expect(b?.settings).toEqual({})
  })

  it('preserva los ajustes NO-branding tal cual', async () => {
    setupDb([
      {
        id: 't-1',
        name: 'T',
        logoUrl: null,
        settings: {
          primaryColor: '#ff0000',
          storeDescription: 'Una tienda',
          socialLinks: { instagram: 'https://ig.com/x' },
        },
      },
    ])

    const b = await getTenantBrandingBySlug('tienda1')

    expect(b?.settings.primaryColor).toBe('#ff0000')
    expect(b?.settings.storeDescription).toBe('Una tienda')
    expect(b?.settings.socialLinks?.instagram).toBe('https://ig.com/x')
  })

  it('el campo deprecado del jsonb no se borra, pero tampoco es legible por tipo', async () => {
    const rawSettings = {
      logoUrl: 'https://cdn.example.com/jsonb.png',
      primaryColor: '#ff0000',
    }
    setupDb([
      {
        id: 't-1',
        name: 'T',
        logoUrl: 'https://cdn.example.com/columna.png',
        settings: rawSettings,
      },
    ])

    const b = await getTenantBrandingBySlug('tienda1')

    // El helper pasa `settings` verbatim: la migracion 0005 declaro el jsonb
    // deprecado pero **intacto**, y borrarlo aqui seria una segunda mutacion
    // silenciosa. Se comprueba por identidad, sin tocar el tipo.
    expect(b?.settings).toBe(rawSettings)

    // Lo que el tipo hace es la garantia real: `settings.logoUrl` no compila,
    // porque `TenantBranding['settings']` no declara el campo. Un consumidor
    // tiene que usar `b.logoUrl`, y eso viene de la columna.
    expect(b?.logoUrl).toBe('https://cdn.example.com/columna.png')
  })

  it('no captura errores: el caller decide el fallback', async () => {
    ;(db as unknown as { limit: ReturnType<typeof vi.fn> }).limit = vi
      .fn()
      .mockRejectedValue(new Error('db caida'))

    // El helper deja propagar. layout.tsx y perfil/page.tsx tienen su propio
    // try/catch con defaults; envolver aqui seria cambiar su comportamiento.
    await expect(getTenantBrandingBySlug('tienda1')).rejects.toThrow('db caida')
  })
})
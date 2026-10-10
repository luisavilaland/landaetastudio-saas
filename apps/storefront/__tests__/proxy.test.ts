import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

/**
 * Tests de la resolucion de tenant del storefront (item 93, T4).
 *
 * **Este archivo importa `proxy()` de verdad.** El anterior -24 lineas- no lo
 * hacia: reimplementaba la resolucion con `split('.')` sobre strings y assertaba
 * sobre esa copia. Habria pasado en verde **si se borraba `proxy.ts` entero**.
 *
 * Es el item 62 con un caso nuevo, y es peor que el original: ahi el *nombre*
 * de la funcion mentia sobre el codigo; acia miente **el archivo entero** sobre
 * si hay cobertura. Un reviewer que ve `proxy.test.ts` con 3 tests en verde
 * marca el casillero de resolucion de tenant sin abrirlo.
 *
 * Con T4 ese hueco era concreto: el filtro `status = 'active'` se agregaba a
 * estos lookups, y este test no habria detectado **ninguna** regresion de el,
 * porque no ejecuta el codigo que se estaba cambiando.
 *
 * ## El patron
 *
 * El mock de `db.select` se controla por caso: cada test dice que filas
 * devuelve. Cuando un camino **no** debe tocar la base, se pasa `selectThrows`
 * y el test revienta si lo hace. Eso es lo que permite afirmar "no consulto la
 * base" sin inspeccionar cadenas de llamadas.
 */

type TenantRow = { slug: string; id: string }

interface SelectOptions {
  rows?: TenantRow[]
  /** Que `db.select()` tire: para afirmar que un camino no consulta la base. */
  throws?: boolean
}

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return {
    ...actual,
    db: { select: (...args: unknown[]) => selectMock(...args) },
  }
})

import { proxy } from '../proxy'

const TENANT_ACTIVO: TenantRow = {
  slug: 'tienda1',
  id: '11111111-1111-4111-8111-111111111111',
}
const OTRO_TENANT: TenantRow = {
  slug: 'tienda2',
  id: '22222222-2222-4222-8222-222222222222',
}

/** Condiciones del ultimo `where()`. Permite afirmar que el filtro sigue ahi. */
let lastWhereArg: unknown = null

/** Encadena la respuesta del mock para una cantidad de llamadas. */
function rowsQueRetorna(...responses: SelectOptions[]) {
  let i = 0
  selectMock.mockImplementation(() => {
    const opts = responses[i] ?? responses[responses.length - 1] ?? {}
    i += 1
    const chain = {
      from: () => chain,
      where: (cond: unknown) => {
        lastWhereArg = cond
        return chain
      },
      limit: async () => {
        if (opts.throws) throw new Error('db.select no deberia llamarse')
        return opts.rows ?? []
      },
    }
    return chain
  })
}

/**
 * El SQL real del ultimo `where()`.
 *
 * **Por que serializar y no contar condiciones.** La primera version de este
 * test afirmaba `queryChunks.length > 1`, y **no detectaba nada**: tanto
 * `eq(a, b)` como `and(a, b)` producen un `SQL` con dos chunks. Con el filtro de
 * status removido, el test pasaba igual de verde - el mismo defecto del item 61,
 * y el mismo del item 93: **una asercion que acompana y no verifica.**
 *
 * Serializar el SQL y buscar el nombre de la columna si que discrimina: si
 * `status` desaparece del `WHERE`, el string deja de contenerlo.
 */
function whereSql(): string {
  if (lastWhereArg === null) return ''
  return new PgDialect().sqlToQuery(lastWhereArg as SQL).sql
}

function whereTouched(): boolean {
  return lastWhereArg !== null
}

function requestFor(host: string, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers({ host, ...extraHeaders })
  return new NextRequest('https://placeholder.test/algo', { headers })
}

describe('proxy - resolucion de tenant', () => {
  const envBackup: Record<string, string | undefined> = {}

  beforeEach(() => {
    selectMock.mockReset()
    lastWhereArg = null
    envBackup.PLATFORM_HOST = process.env.PLATFORM_HOST
    envBackup.DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG
    envBackup.ENABLE_DEFAULT_TENANT_FALLBACK =
      process.env.ENABLE_DEFAULT_TENANT_FALLBACK
    delete process.env.PLATFORM_HOST
    delete process.env.DEFAULT_TENANT_SLUG
    delete process.env.ENABLE_DEFAULT_TENANT_FALLBACK
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  describe('filtro por status (T4)', () => {
    it('el subdominio solo resuelve si el tenant esta active', async () => {
      // Simula la fila que devuelve la consulta **con el filtro aplicado**: si
      // el tenant no esta active, el WHERE no matchea y no hay filas.
      rowsQueRetorna({ rows: [] })

      const res = await proxy(requestFor('tienda-pendiente.lvh.me'))

      expect(res.status).toBe(404)
    })

    it('un tenant active resuelve por subdominio', async () => {
      // customDomain falla primero (0 filas) y recien ahi se prueba el slug.
      rowsQueRetorna({ rows: [] }, { rows: [TENANT_ACTIVO] })

      const res = await proxy(requestFor('tienda1.lvh.me'))

      expect(res.status).toBe(200)
      expect(res.headers.get('x-tenant-slug')).toBe('tienda1')
      expect(res.headers.get('x-tenant-id')).toBe(TENANT_ACTIVO.id)
    })

    it('el lookup por subdominio incluye la condicion de status', async () => {
      rowsQueRetorna({ rows: [] }, { rows: [TENANT_ACTIVO] })

      await proxy(requestFor('tienda1.lvh.me'))

      expect(whereTouched()).toBe(true)
      expect(whereSql()).toContain('"slug"')
      expect(whereSql()).toContain('"status"')
    })

    it('el lookup por customDomain tambien filtra por status', async () => {
      // Aca resuelve en el primer lookup, asi que el `where` que se midio es el suyo.
      rowsQueRetorna({ rows: [OTRO_TENANT] })

      const res = await proxy(requestFor('mitienda.com.ar'))

      expect(res.status).toBe(200)
      expect(whereSql()).toContain('"customDomain"')
      expect(whereSql()).toContain('"status"')
    })

    it('la cookie tambien lleva el filtro de status en el WHERE', async () => {
      rowsQueRetorna({ rows: [] })

      await proxy(
        requestFor('www.lvh.me', { cookie: 'tenant-slug=tienda-pendiente' }),
      )

      expect(whereSql()).toContain('"status"')
    })
  })

  describe('cookie tenant-slug', () => {
    it('un slug en la cookie que no es active NO resuelve', async () => {
      // El caso que el refinamiento de T4 menciona: la cookie es user-controlled.
      // Antes tomaba el valor crudo y resolvia cualquier tenant.
      rowsQueRetorna({ rows: [] })

      const res = await proxy(
        requestFor('www.lvh.me', { cookie: 'tenant-slug=tienda-pendiente' }),
      )

      expect(res.status).toBe(404)
    })

    it('un slug en la cookie que SI es active resuelve, y trae tenantId', async () => {
      // Antes este camino dejaba `tenantId` en null, o sea sin header
      // `x-tenant-id` - que es lo que despues usan las queries con RLS.
      rowsQueRetorna({ rows: [OTRO_TENANT] })

      const res = await proxy(
        requestFor('www.lvh.me', { cookie: 'tenant-slug=tienda2' }),
      )

      expect(res.status).toBe(200)
      expect(res.headers.get('x-tenant-slug')).toBe('tienda2')
      expect(res.headers.get('x-tenant-id')).toBe(OTRO_TENANT.id)
    })
  })

  describe('PLATFORM_HOST (D1)', () => {
    it('el host de plataforma no resuelve tenant ni toca la base', async () => {
      process.env.PLATFORM_HOST = 'app.landaetastudio.com'
      rowsQueRetorna({ throws: true })

      const res = await proxy(requestFor('app.landaetastudio.com'))

      expect(res.status).toBe(200)
      expect(res.headers.get('x-tenant-slug')).toBeNull()
      expect(selectMock).not.toHaveBeenCalled()
    })
  })

  describe('fallbacks de desarrollo (T4)', () => {
    // Cualquier host con punto entra primero a los dos lookups con base
    // (customDomain y subdominio). Para llegar al fallback hay que que ambos
    // devuelvan 0 filas, que es el caso normal en un host de Preview.
    it('sin el gate, DEFAULT_TENANT_SLUG no resuelve', async () => {
      process.env.DEFAULT_TENANT_SLUG = 'tienda1'
      rowsQueRetorna({ rows: [] })

      const res = await proxy(requestFor('preview.vercel.app'))

      expect(res.status).toBe(404)
      expect(res.headers.get('x-tenant-slug')).toBeNull()
    })

    it('con el gate en "true", DEFAULT_TENANT_SLUG resuelve', async () => {
      process.env.DEFAULT_TENANT_SLUG = 'tienda1'
      process.env.ENABLE_DEFAULT_TENANT_FALLBACK = 'true'
      rowsQueRetorna({ rows: [] })

      const res = await proxy(requestFor('preview.vercel.app'))

      expect(res.status).toBe(200)
      expect(res.headers.get('x-tenant-slug')).toBe('tienda1')
    })

    it('el gate exige el string exacto "true"', async () => {
      process.env.DEFAULT_TENANT_SLUG = 'tienda1'
      process.env.ENABLE_DEFAULT_TENANT_FALLBACK = '1'
      rowsQueRetorna({ rows: [] })

      const res = await proxy(requestFor('preview.vercel.app'))

      expect(res.status).toBe(404)
    })
  })
})

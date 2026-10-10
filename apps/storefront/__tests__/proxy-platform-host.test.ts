import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Tests del proxy del storefront (D1 del design de Fase 3).
 *
 * **Este archivo SI ejecuta `proxy()`.** El test anterior -`proxy.test.ts`-
 * reimplementaba la resolucion con manipulacion de strings y assertaba sobre
 * esa copia: nunca importaba el proxy, asi que se podia borrar el archivo
 * entero y el test seguiria en verde. Es el item 62 aplicado a este archivo: un
 * test cuyo nombre promete cobertura y no cubre nada.
 *
 * Lo que importa verificar aca es el **orden**: la excepcion de `PLATFORM_HOST`
 * tiene que ocurrir ANTES de cualquier resolucion, incluida la cookie. Si queda
 * despues, un `tenant-slug` de una visita anterior a una tienda resuelve un
 * tenant en el host de plataforma.
 */

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
    // `select` tira si se lo llama: asi un test que espera "no se resolvio
    // tenant" detecta el acceso a la DB sin tener que inspeccionar la cadena.
    db: {
      select: (...args: unknown[]) => {
        selectMock(...args)
        throw new Error('db.select no deberia llamarse en este test')
      },
    },
  }
})

import { proxy } from '../proxy'

function requestFor(host: string, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers({ host, ...extraHeaders })
  return new NextRequest('https://placeholder.test/algo', { headers })
}

describe('proxy - excepcion de PLATFORM_HOST (D1)', () => {
  const originalPlatformHost = process.env.PLATFORM_HOST
  const originalDefaultSlug = process.env.DEFAULT_TENANT_SLUG

  beforeEach(() => {
    selectMock.mockClear()
    // `DEFAULT_TENANT_SLUG` es el fallback que secuestraba el host de
    // plataforma. Se pone aqui a proposito: el test tiene que pasar CON el
    // fallback configurado, porque ese es el escenario que motivo la decision
    // de ubicar la excepcion antes de los fallbacks.
    process.env.DEFAULT_TENANT_SLUG = 'tienda1'
    process.env.PLATFORM_HOST = 'app.landaetastudio.com'
    process.env.ENABLE_DEFAULT_TENANT_FALLBACK = 'true'
  })

  afterEach(() => {
    if (originalPlatformHost === undefined) delete process.env.PLATFORM_HOST
    else process.env.PLATFORM_HOST = originalPlatformHost
    if (originalDefaultSlug === undefined)
      delete process.env.DEFAULT_TENANT_SLUG
    else process.env.DEFAULT_TENANT_SLUG = originalDefaultSlug
    delete process.env.ENABLE_DEFAULT_TENANT_FALLBACK
  })

  it('el host de plataforma pasa sin resolver tenant y sin tocar la DB', async () => {
    const res = await proxy(requestFor('app.landaetastudio.com'))

    expect(res.status).toBe(200)
    // Si se hubiera resuelto un tenant, el proxy habria puesto estos headers.
    expect(res.headers.get('x-tenant-slug')).toBeNull()
    expect(res.headers.get('x-tenant-id')).toBeNull()
    expect(selectMock).not.toHaveBeenCalled()
  })

  it('el host de plataforma gana aunque venga una cookie de tenant previa', async () => {
    // Este es el caso que hace que la excepcion tenga que ir antes de los
    // fallbacks y no solo antes del 404.
    const res = await proxy(
      requestFor('app.landaetastudio.com', {
        cookie: 'tenant-slug=la-tienda-que-visite-antes',
      }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('x-tenant-slug')).toBeNull()
    expect(selectMock).not.toHaveBeenCalled()
  })

  it('un host de tenant no dispara la excepcion (intenta resolver)', async () => {
    const res = await proxy(requestFor('tienda1.lvh.me'))

    expect(selectMock).toHaveBeenCalled()
    // El `db.select` mock tira y el proxy lo captura en su `catch`, asi que
    // `tenantSlug` sigue null. Lo que se verifica aca es que la excepcion de
    // plataforma NO se disparo para un host de tenant: si se hubiera
    // disparado, `selectMock` estaria vacio.
  })

  it('sin PLATFORM_HOST, el host de plataforma cae en el fallback y resuelve un tenant', async () => {
    // ESTE es el motivo de D1. Sin la excepcion, el host de plataforma pasa por
    // los fallbacks y `DEFAULT_TENANT_SLUG` le asigna una tienda: la landing se
    // serviria dentro del storefront de un tenant.
    //
    // Necesita `ENABLE_DEFAULT_TENANT_FALLBACK=true` (lo pone `beforeEach`):
    // desde T4 los fallbacks de dev estan gateados por env var.
    delete process.env.PLATFORM_HOST

    const res = await proxy(requestFor('app.landaetastudio.com'))

    expect(res.status).toBe(200)
    expect(res.headers.get('x-tenant-slug')).toBe('tienda1')
    expect(selectMock).toHaveBeenCalled()
  })

  it('T4: sin ENABLE_DEFAULT_TENANT_FALLBACK, el fallback NO resuelve', async () => {
    // El refinamiento de T4: los fallbacks de dev no se validan contra la
    // base, se **gatean**. Apagados, el host cae en el 404.
    //
    // Este es el cierre del hallazgo que reporto el PR #240: antes,
    // `DEFAULT_TENANT_SLUG` resolvia un tenant sin filtro en cualquier entorno.
    delete process.env.PLATFORM_HOST
    delete process.env.ENABLE_DEFAULT_TENANT_FALLBACK

    const res = await proxy(requestFor('tenant-inexistente.example.com'))

    expect(res.status).toBe(404)
    expect(res.headers.get('x-tenant-slug')).toBeNull()
  })

  it('T4: el gate exige el string exacto "true" (fail-closed)', async () => {
    // `z.literal('true')` en la validacion y `=== 'true'` en el proxy: un
    // `'1'` o un `'TRUE'` dejan el fallback apagado. El costo de un fallback
    // apagado de mas es un 404 visible; el de uno encendido de mas es un tenant
    // equivocado servido.
    delete process.env.PLATFORM_HOST
    process.env.ENABLE_DEFAULT_TENANT_FALLBACK = '1'

    const res = await proxy(requestFor('tenant-inexistente.example.com'))

    expect(res.status).toBe(404)
  })

  it('T4: el fallback gateado resuelve sin confirmar el status en la DB', async () => {
    // Documenta lo que el refinamiento de T4 decidio **a proposito**: el
    // fallback de dev no consulta la base, no verifica existencia ni status, y
    // deja `tenantId` en null.
    //
    // La compensacion es el gate, no la validacion: en cualquier entorno donde
    // este camino no deberia existir, no existe.
    const res = await proxy(requestFor('tenant-inexistente.example.com'))

    expect(res.status).toBe(200)
    expect(res.headers.get('x-tenant-slug')).toBe('tienda1')
    // `tenantId` nunca se setea en los fallbacks, asi que el header no existe.
    expect(res.headers.get('x-tenant-id')).toBeNull()
  })

  it('el puerto se ignora al comparar (el host llega con :3000 en local)', async () => {
    const res = await proxy(requestFor('app.landaetastudio.com:3000'))

    expect(res.status).toBe(200)
    expect(res.headers.get('x-tenant-slug')).toBeNull()
    expect(selectMock).not.toHaveBeenCalled()
  })
})

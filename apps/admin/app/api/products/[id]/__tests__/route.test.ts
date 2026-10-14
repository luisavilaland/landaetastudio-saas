import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Product, ProductVariant, ProductImage } from '@repo/db'
import { db, withTenantContext } from '@repo/db'
import { makeTxMock, session, mockReq } from '@repo/test-utils'
// S4c/item 103: se mockea getPermissions (la FUENTE), no el guard.
// El endpoint sigue llamando al guard REAL: si alguien borra la linea del
// guard, el 403 no aparece y el test falla.
vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return { ...actual, getPermissions: vi.fn() }
})


vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@repo/storage', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://cdn.example.com/img.png'),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return {
    ...actual,
    withTenantContext: vi.fn(),
    db: {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  }
})

import { auth } from '@/lib/auth'
import { GET, PUT, DELETE } from '../route'
import { getPermissions } from '@repo/commerce'
/** Tenant active + suscripcion active: todo permitido. */
const FULL_ACCESS = {
  canWrite: true,
  canSell: true,
  canChangePlan: true,
  canCancel: true,
  canReactivate: false,
  canPause: true,
  canResume: false,
  canAccessStorefront: true,
  canAccessPanel: 'full',
} as const

beforeEach(() => {
  vi.mocked(getPermissions).mockResolvedValue(FULL_ACCESS)
})


const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'
const PRODUCT_ID = 'product-123'
const NOW = new Date('2025-01-01T00:00:00.000Z')

const baseProduct: Product = {
  id: PRODUCT_ID,
  tenantId: TENANT_A,
  categoryId: null,
  name: 'Test Product',
  slug: 'test-product',
  description: null,
  imageUrl: null,
  status: 'active',
  metadata: {},
  createdAt: NOW,
  updatedAt: NOW,
}

const baseVariant: ProductVariant = {
  id: 'variant-123',
  tenantId: TENANT_A,
  productId: PRODUCT_ID,
  sku: 'test-product',
  price: 1999,
  stock: 10,
  options: {},
  createdAt: NOW,
  updatedAt: NOW,
}

const baseImage: ProductImage = {
  id: 'image-123',
  productId: PRODUCT_ID,
  tenantId: TENANT_A,
  url: 'https://cdn.example.com/img.png',
  alt: null,
  position: 0,
  createdAt: NOW,
}

function makeSelectChain<T>(value: T) {
  const promise = Promise.resolve(value)
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(value),
    orderBy: vi.fn().mockResolvedValue(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  } as unknown as ReturnType<typeof db.select>
}

// ──────── GET ────────

describe('GET /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 sin sesión', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('404 cross-tenant', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, 'admin@b.com'))
    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(makeSelectChain([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('200 feliz con variant e images', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]))
      .mockReturnValueOnce(makeSelectChain([baseImage]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(PRODUCT_ID)
    expect(data.name).toBe('Test Product')
    expect(data.variant).toBeDefined()
    expect(data.images).toHaveLength(1)
  })
})

// ──────── PUT ────────

describe('PUT /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 sin sesión', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PUT(mockReq('PUT', { name: 'X' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('404 cross-tenant', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, 'admin@b.com'))
    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(makeSelectChain([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await PUT(mockReq('PUT', { name: 'X' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('400 validación Zod falla', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const res = await PUT(mockReq('PUT', { price: -1 }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('409 slug duplicado', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([{ ...baseProduct, id: 'other' }]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await PUT(mockReq('PUT', { slug: 'other-slug' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.field).toBe('slug')
  })

  it('409 SKU duplicado al regenerar por slug change', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const variantWithOptions: ProductVariant = {
      ...baseVariant,
      options: { color: 'rojo' },
      sku: 'test-product-rojo',
    }
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct])) // 1. get product
      .mockReturnValueOnce(makeSelectChain([])) // 2. slug uniqueness — ok
      .mockReturnValueOnce(makeSelectChain([variantWithOptions])) // 3. existing variants
      .mockReturnValueOnce(
        makeSelectChain([{ ...variantWithOptions, id: 'other-variant' }]),
      ) // 4. SKU dup
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await PUT(mockReq('PUT', { slug: 'new-slug' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.field).toBe('sku')
  })

  it('200 feliz', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const updatedProduct = { ...baseProduct, name: 'Updated Product' }
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct])) // 1. get product
      .mockReturnValueOnce(makeSelectChain([baseVariant])) // 2. get variants (no limit)
      .mockReturnValueOnce(makeSelectChain([updatedProduct])) // 3. refetch product
      .mockReturnValueOnce(makeSelectChain([baseVariant])) // 4. refetch variant
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await PUT(mockReq('PUT', { name: 'Updated Product' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Updated Product')
    expect(data.variant).toBeDefined()
  })

  describe('S4c / item 103 — regresión', () => {
  /**
   * El handler declara `let tenantId = ''` arriba y lo asigna adentro del
   * `try`. Un guard insertado antes de la asignacion consulta por string
   * vacio: en produccion denies para TODOS los tenants.
   *
   * Este test falla si el guard vuelve a correr antes de resolver el tenant.
   * Lo encontro el hook GGA, no la suite: `getPermissions` esta mockeado, asi
   * que un string vacio no rompe nada en los tests. El patron del item 61.
   */
  it('el guard consulta por el tenantId RESUELTO, no por el string vacio', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const updatedProduct = { ...baseProduct, name: 'Updated Product' }
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]))
      .mockReturnValueOnce(makeSelectChain([updatedProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]))
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(mockTx))

    const res = await PUT(mockReq('PUT', { name: 'Updated Product' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })

    expect(res.status).toBe(200)
    expect(getPermissions).toHaveBeenCalled()
    const calledWith = vi.mocked(getPermissions).mock.calls[0]
    expect(calledWith[1]).toBe(TENANT_A)
    expect(calledWith[1]).not.toBe('')
  })

    it('deniega cuando falta canWrite (403)', async () => {
      vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
      vi.mocked(getPermissions).mockResolvedValue({
        ...FULL_ACCESS,
        canWrite: false,
        canSell: true,
      })

      // Mismo tx del happy path, sin reservar slot para el guard (item 117): el
      // guard abre su propia transaccion y se queda con la primera, pero como
      // `getPermissions` esta mockeado no le importa cual recibe. Asi, si el
      // guard desapareciera, el handler completaria y responderia 200 — la
      // senal real — en vez de reventar con un 500 por falta de mock.
      const updatedProduct = { ...baseProduct, name: 'X' }
      const mockTx = makeTxMock()
      mockTx.select
        .mockReturnValueOnce(makeSelectChain([baseProduct]))
        .mockReturnValueOnce(makeSelectChain([baseVariant]))
        .mockReturnValueOnce(makeSelectChain([updatedProduct]))
        .mockReturnValueOnce(makeSelectChain([baseVariant]))
      vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
        cb(mockTx),
      )

      const res = await PUT(mockReq('PUT', { name: 'X' }), {
        params: Promise.resolve({ id: PRODUCT_ID }),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.permission).toBe('canWrite')
    })
})

it('409 si el producto fue eliminado entre la lectura y la escritura (0 filas en fase de escritura)', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct])) // fase 1: leer producto
      .mockReturnValueOnce(makeSelectChain([baseVariant])) // fase 1: variantes existentes
      .mockReturnValueOnce(makeSelectChain([])) // fase 3: refetch producto → 0 filas
      .mockReturnValueOnce(makeSelectChain([])) // fase 3: refetch variante
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await PUT(mockReq('PUT', { name: 'Updated Product' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Producto eliminado durante la actualización')
  })

  it('409 si la fase de escritura lanza violación de FK 23503 (producto borrado)', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct])) // fase 1: leer producto
      .mockReturnValueOnce(makeSelectChain([baseVariant])) // fase 1: variantes existentes
    vi.mocked(withTenantContext)
      .mockImplementationOnce(async (_tenantId, cb) => cb(mockTx)) // fase 1 ok
      .mockImplementationOnce(async () => {
        throw Object.assign(
          new Error(
            'insert or update on table product_variants violates foreign key constraint',
          ),
          { code: '23503' },
        )
      }) // fase 3 lanza violación de FK
    const res = await PUT(mockReq('PUT', { name: 'Updated Product' }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Producto eliminado durante la actualización')
  })
})

// ──────── DELETE ────────

describe('DELETE /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 sin sesión', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('404 cross-tenant', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, 'admin@b.com'))
    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(makeSelectChain([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_B,
      expect.any(Function),
    )
  })

  it('204 feliz', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'variant-123' }]))
      .mockReturnValueOnce(makeSelectChain([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(204)
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_A,
      expect.any(Function),
    )
  })
})

/**
 * Item 117 / H-F3-s4c-1: cobertura de denegacion para el guard de DELETE.
 *
 * El mock de `withTenantContext` devuelve SIEMPRE la tx del happy path, sin
 * reservar un slot para el guard. El guard abre su propia transaccion y se
 * queda con la primera, pero como `getPermissions` esta mockeado no le importa
 * cual recibe. Con guard responde 403; sin guard el handler completa y
 * responde 204, y el assert falla con 204 en vez de romperse con un 500.
 */
describe('S4c / item 117 — el guard IMPONE (DELETE)', () => {
  it('DELETE /api/products/[id] devuelve 403 sin canWrite', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    vi.mocked(getPermissions).mockResolvedValue({
      ...FULL_ACCESS,
      canWrite: false,
      canSell: false,
      canAccessPanel: 'none',
    })

    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'variant-123' }]))
      .mockReturnValueOnce(makeSelectChain([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })

    // El status se assertea ANTES de leer el body a proposito: un DELETE
    // exitoso responde 204 sin cuerpo, y `res.json()` ahi tira. Si el guard
    // desapareciera, leer el body primero convertiria el fallo en un 500 del
    // catch del handler y taparia la senal real.
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.permission).toBe('canWrite')
    expect(body.error).toBe('La suscripción no permite publicar contenido')
  })
})

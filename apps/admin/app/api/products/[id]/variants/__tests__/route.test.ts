import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Product, ProductVariant } from '@repo/db'
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

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: { transaction: vi.fn() } }
})

import { auth } from '@/lib/auth'
import { GET, POST } from '../route'
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

describe('GET /api/products/[id]/variants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock()),
    )
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
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_B,
      expect.any(Function),
    )
  })

  it('200 feliz', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))

    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.variants).toHaveLength(1)
    expect(data.variants[0].sku).toBe('test-product')
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_A,
      expect.any(Function),
    )
  })
})

/**
 * Item 117 / H-F3-s4c-1: cobertura de denegacion para el guard de POST.
 *
 * El mock de `withTenantContext` devuelve SIEMPRE la tx del happy path, sin
 * reservar un slot para el guard. El guard abre su propia transaccion y se
 * queda con la primera, pero como `getPermissions` esta mockeado no le importa
 * cual recibe. Con guard responde 403; sin guard el handler completa y
 * responde 200, y el assert falla con 200 en vez de romperse con un 500.
 */
describe('S4c / item 117 — el guard IMPONE (POST)', () => {
  it('POST /api/products/[id]/variants devuelve 403 sin canWrite', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))
    vi.mocked(getPermissions).mockResolvedValue({
      ...FULL_ACCESS,
      canWrite: false,
      canSell: false,
      canAccessPanel: 'none',
    })

    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseProduct]))
    mockTx.select.mockReturnValueOnce(makeSelectChain([]))
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseVariant]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await POST(
      mockReq('POST', { variants: [{ price: 2999, stock: 20 }] }),
      { params: Promise.resolve({ id: PRODUCT_ID }) },
    )

    // Status antes que body: si el status no es 403 no hay nada que leer del
    // body, y leerlo primero convertiria un 200 en un 500 del catch.
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.permission).toBe('canWrite')
    expect(body.error).toBe('La suscripción no permite publicar contenido')
  })
})

// ──────── POST ────────

describe('POST /api/products/[id]/variants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock()),
    )
  })

  it('401 sin sesión', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await POST(
      mockReq('POST', { variants: [{ price: 1999, stock: 5 }] }),
      {
        params: Promise.resolve({ id: PRODUCT_ID }),
      },
    )
    expect(res.status).toBe(401)
  })

  it('404 cross-tenant', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, 'admin@b.com'))

    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(makeSelectChain([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await POST(
      mockReq('POST', { variants: [{ price: 1999, stock: 5 }] }),
      {
        params: Promise.resolve({ id: PRODUCT_ID }),
      },
    )
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_B,
      expect.any(Function),
    )
  })

  it('400 validación falla', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))

    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseProduct]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await POST(
      mockReq('POST', { variants: [{ price: -1, stock: 5 }] }),
      {
        params: Promise.resolve({ id: PRODUCT_ID }),
      },
    )
    expect(res.status).toBe(400)
  })

  it('200 feliz upsert de variantes', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))

    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseProduct]))
    mockTx.select.mockReturnValueOnce(makeSelectChain([]))
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseVariant]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await POST(
      mockReq('POST', { variants: [{ price: 2999, stock: 20 }] }),
      {
        params: Promise.resolve({ id: PRODUCT_ID }),
      },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.variants).toHaveLength(1)
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_A,
      expect.any(Function),
    )
  })

  it('409 violación FK (variante tiene órdenes)', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, 'admin@a.com'))

    const err = new Error('SQL foreign key violation')
    ;(err as any).code = '23503'
    vi.mocked(withTenantContext).mockRejectedValueOnce(err)

    const res = await POST(
      mockReq('POST', { variants: [{ price: 2999, stock: 20 }] }),
      {
        params: Promise.resolve({ id: PRODUCT_ID }),
      },
    )
    expect(res.status).toBe(409)
  })
})

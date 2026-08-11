import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/tenant', () => ({
  getTenantId: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  safeGet: vi.fn(),
  redisSetEx: vi.fn(),
  redisDel: vi.fn(),
}))

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
    withTenantContext: vi.fn(),
    db: { select: vi.fn(), update: vi.fn(), insert: vi.fn(), delete: vi.fn() },
  }
})

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { db, withTenantContext } from '@repo/db'
import { safeGet, redisSetEx, redisDel } from '@/lib/redis'
import { getTenantId } from '@/lib/tenant'
import { makeTxMock, mockReq } from '@repo/test-utils'
import { GET, POST, PUT, DELETE } from '../route'

const TENANT_ID = 'tenant-123'
const CROSS_TENANT_ID = 'tenant-b'
const SESSION_ID = 'session-abc-123'
const VARIANT_ID = 'variant-1'

const MOCK_VARIANT = {
  id: VARIANT_ID,
  tenantId: TENANT_ID,
  productId: 'product-1',
  sku: 'SKU-001',
  price: 1999,
  stock: 10,
  options: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

const MOCK_CART = {
  items: [
    { variantId: VARIANT_ID, quantity: 2, addedAt: new Date().toISOString() },
  ],
  updatedAt: new Date().toISOString(),
}

const MOCK_EMPTY_CART = {
  items: [],
  updatedAt: new Date().toISOString(),
}

const MOCK_ENRICHED_VARIANT = {
  variantId: VARIANT_ID,
  variantPrice: 1999,
  variantStock: 10,
  variantSku: 'SKU-001',
  variantOptions: {},
  productId: 'product-1',
  productName: 'Producto de prueba',
  productSlug: 'producto-de-prueba',
  productImage: 'https://example.com/img.jpg',
}

function createQuery<T>(resolveValue: T[]): any {
  const q = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
    orderBy: vi.fn().mockReturnThis(),
    then: (onFulfilled: (v: T[]) => unknown) =>
      Promise.resolve(resolveValue).then(onFulfilled),
  }
  return q
}

function setupHeaders(sessionId: string | undefined) {
  const mockHeaders = { get: vi.fn() }
  vi.mocked(headers).mockResolvedValue(mockHeaders as any)
  mockHeaders.get.mockImplementation((key: string) => {
    if (key === 'x-cart-session-id') return sessionId
    return null
  })
}

describe('POST /api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID)
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_EMPTY_CART))
    vi.mocked(redisSetEx).mockResolvedValue(undefined)
  })

  it('debe devolver 400 cuando no hay session ID', async () => {
    setupHeaders(undefined)

    const res = await POST(
      mockReq('POST', { variantId: VARIANT_ID, quantity: 1 }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Sesión de carrito no encontrada')
  })

  it('debe devolver 400 cuando no hay tenant', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(getTenantId).mockResolvedValue(null)

    const res = await POST(
      mockReq('POST', { variantId: VARIANT_ID, quantity: 1 }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Tienda no encontrada')
  })

  it('debe devolver 400 cuando la validación Zod falla', async () => {
    setupHeaders(SESSION_ID)

    const res = await POST(mockReq('POST', { quantity: -1 }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validación fallida')
  })

  it('debe devolver 404 cross-tenant cuando la variante no pertenece al tenant', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(getTenantId).mockResolvedValue(CROSS_TENANT_ID)
    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(createQuery([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await POST(
      mockReq('POST', { variantId: VARIANT_ID, quantity: 1 }),
    )

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Variante no encontrada')
  })

  it('debe devolver 400 cuando el stock es insuficiente', async () => {
    setupHeaders(SESSION_ID)
    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(
      createQuery([{ ...MOCK_VARIANT, stock: 0 }]),
    )
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await POST(
      mockReq('POST', { variantId: VARIANT_ID, quantity: 1 }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Stock insuficiente')
  })

  it('debe agregar un ítem al carrito en caso feliz', async () => {
    setupHeaders(SESSION_ID)
    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(createQuery([MOCK_VARIANT]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await POST(
      mockReq('POST', { variantId: VARIANT_ID, quantity: 1 }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.cart.items).toHaveLength(1)
    expect(body.cart.items[0].variantId).toBe(VARIANT_ID)
  })

  it('debe incrementar cantidad cuando la variante ya existe en el carrito', async () => {
    setupHeaders(SESSION_ID)
    const mockTx = makeTxMock()
    mockTx.select.mockReturnValueOnce(createQuery([MOCK_VARIANT]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART))

    const res = await POST(
      mockReq('POST', { variantId: VARIANT_ID, quantity: 3 }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cart.items[0].quantity).toBe(5)
  })
})

describe('GET /api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID)
  })

  it('debe devolver carrito vacío cuando no hay session ID', async () => {
    setupHeaders(undefined)

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('debe devolver 400 cuando no hay tenant', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(getTenantId).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Tienda no encontrada')
  })

  it('debe devolver items vacíos cuando el carrito está vacío', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_EMPTY_CART))

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('debe devolver items enriquecidos en caso feliz', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART))
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(createQuery([MOCK_ENRICHED_VARIANT]))
      .mockReturnValueOnce(createQuery([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].variantId).toBe(VARIANT_ID)
    expect(body.items[0].product.name).toBe('Producto de prueba')
  })
})

describe('PUT /api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID)
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART))
    vi.mocked(redisSetEx).mockResolvedValue(undefined)
  })

  it('debe devolver 400 cuando no hay session ID', async () => {
    setupHeaders(undefined)

    const res = await PUT(
      mockReq('PUT', { variantId: VARIANT_ID, quantity: 3 }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Sesión de carrito no encontrada')
  })

  it('debe devolver 400 cuando no hay tenant', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(getTenantId).mockResolvedValue(null)

    const res = await PUT(
      mockReq('PUT', { variantId: VARIANT_ID, quantity: 3 }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Tienda no encontrada')
  })

  it('debe devolver 400 cuando la validación Zod falla', async () => {
    setupHeaders(SESSION_ID)

    const res = await PUT(mockReq('PUT', {}))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validación fallida')
  })

  it('debe actualizar cantidad en caso feliz', async () => {
    setupHeaders(SESSION_ID)
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(createQuery([MOCK_ENRICHED_VARIANT]))
      .mockReturnValueOnce(createQuery([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await PUT(
      mockReq('PUT', { variantId: VARIANT_ID, quantity: 5 }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].variantId).toBe(VARIANT_ID)
  })

  it('debe devolver items vacíos cuando ninguna variante coincide con el tenant (cross-tenant)', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(getTenantId).mockResolvedValue(CROSS_TENANT_ID)
    const mockTx = makeTxMock()
    mockTx.select
      .mockReturnValueOnce(createQuery([]))
      .mockReturnValueOnce(createQuery([]))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockTx),
    )

    const res = await PUT(
      mockReq('PUT', { variantId: VARIANT_ID, quantity: 3 }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})

describe('DELETE /api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID)
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART))
    vi.mocked(redisSetEx).mockResolvedValue(undefined)
    vi.mocked(redisDel).mockResolvedValue(undefined)
  })

  it('debe devolver 400 cuando no hay session ID', async () => {
    setupHeaders(undefined)

    const res = await DELETE(mockReq('DELETE', { variantId: VARIANT_ID }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Sesión de carrito no encontrada')
  })

  it('debe devolver 400 cuando no hay tenant', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(getTenantId).mockResolvedValue(null)

    const res = await DELETE(mockReq('DELETE', { variantId: VARIANT_ID }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Tienda no encontrada')
  })

  it('debe devolver 400 cuando la validación Zod falla', async () => {
    setupHeaders(SESSION_ID)

    const res = await DELETE(mockReq('DELETE', {}))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validación fallida')
  })

  it('debe limpiar todo el carrito cuando clearAll es true', async () => {
    setupHeaders(SESSION_ID)

    const res = await DELETE(mockReq('DELETE', { clearAll: true }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('debe eliminar un ítem específico en caso feliz', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(db.select).mockReturnValueOnce(createQuery([]))

    const res = await DELETE(mockReq('DELETE', { variantId: VARIANT_ID }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('debe devolver items vacíos cuando ninguna variante coincide con el tenant (cross-tenant)', async () => {
    setupHeaders(SESSION_ID)
    vi.mocked(getTenantId).mockResolvedValue(CROSS_TENANT_ID)
    vi.mocked(db.select).mockReturnValueOnce(createQuery([]))

    const res = await DELETE(mockReq('DELETE', { variantId: VARIANT_ID }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})

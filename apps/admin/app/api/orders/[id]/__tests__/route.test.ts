import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Order, OrderItem, ProductVariant, Product } from '@repo/db'
import { withTenantContext } from '@repo/db'
import { makeTxMock } from '@repo/test-utils'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: { transaction: vi.fn() } }
})

import { auth } from '@/lib/auth'
import { GET, PUT } from '../route'

function makeGETRequest(id: string) {
  return GET(
    {
      nextUrl: new URL('http://localhost'),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof GET>[0],
    { params: Promise.resolve({ id }) },
  )
}

function makePUTRequest(id: string, body: Record<string, unknown>) {
  return PUT(
    {
      json: async () => body,
      nextUrl: new URL('http://localhost'),
      cookies: { get: () => undefined },
      headers: new Headers(),
    } as unknown as Parameters<typeof PUT>[0],
    { params: Promise.resolve({ id }) },
  )
}

const mockId = 'order-test-id'
const sessionTenant = 'tenant-a'

const mockOrder: Order = {
  id: mockId,
  tenantId: sessionTenant,
  customerId: null,
  customerEmail: 'customer@test.com',
  status: 'pending_payment',
  total: 10000,
  currency: 'UYU',
  shippingDetails: {},
  metadata: {},
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
}

const mockItems: OrderItem[] = [
  {
    id: 'item-1',
    tenantId: sessionTenant,
    orderId: mockId,
    productVariantId: 'variant-1',
    quantity: 2,
    unitPrice: 5000,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  },
]

const mockVariants: ProductVariant[] = [
  {
    id: 'variant-1',
    tenantId: sessionTenant,
    productId: 'product-1',
    sku: 'TEST-SKU',
    price: 5000,
    stock: 10,
    options: {},
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  },
]

const mockProducts: Product[] = [
  {
    id: 'product-1',
    tenantId: sessionTenant,
    categoryId: null,
    name: 'Test Product',
    slug: 'test-product',
    description: null,
    basePrice: 5000,
    currency: 'UYU',
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  },
]

describe('GET /api/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock()),
    )
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await makeGETRequest(mockId)
    expect(res.status).toBe(401)
  })

  it('should return 400 when tenantId is missing', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } })

    const res = await makeGETRequest(mockId)
    expect(res.status).toBe(400)
  })

  it('should return 404 for cross-tenant access', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: 'tenant-b', email: 'admin@b.com' },
    })

    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makeGETRequest(mockId)
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      'tenant-b',
      expect.any(Function),
    )
  })

  it('should return 200 with order and items', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })

    const tx = makeTxMock({
      select: [
        { data: [mockOrder], terminal: 'limit' },
        { data: mockItems },
        { data: mockVariants },
        { data: mockProducts },
      ],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makeGETRequest(mockId)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.id).toBe(mockId)
    expect(data.customerEmail).toBe('customer@test.com')
    expect(data.total).toBe(10000)
    expect(data.status).toBe('pending_payment')
    expect(data.items).toHaveLength(1)
    expect(data.items[0].productName).toBe('Test Product')
    expect(data.items[0].sku).toBe('TEST-SKU')
    expect(data.items[0].quantity).toBe(2)
    expect(data.items[0].unitPrice).toBe(5000)
    expect(withTenantContext).toHaveBeenCalledWith(
      sessionTenant,
      expect.any(Function),
    )
  })
})

describe('PUT /api/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock()),
    )
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await makePUTRequest(mockId, { status: 'confirmed' })
    expect(res.status).toBe(401)
  })

  it('should return 404 for cross-tenant access', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: 'tenant-b', email: 'admin@b.com' },
    })

    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makePUTRequest(mockId, { status: 'confirmed' })
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      'tenant-b',
      expect.any(Function),
    )
  })

  it('should return 400 for invalid body', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })

    const res = await makePUTRequest(mockId, {})
    expect(res.status).toBe(400)
  })

  it('should return 200 on successful update', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })

    const tx = makeTxMock({
      select: [{ data: [{ id: mockId }], terminal: 'limit' }],
    })
    tx.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as ReturnType<typeof db.update>)
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makePUTRequest(mockId, { status: 'confirmed' })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.status).toBe('confirmed')
    expect(withTenantContext).toHaveBeenCalledWith(
      sessionTenant,
      expect.any(Function),
    )
  })
})

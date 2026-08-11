import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { makeTxMock, session, mockReq } from '@repo/test-utils'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@repo/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: undefined }
})

import { auth } from '@/lib/auth'
import { GET } from '../route'

function mockDashboardReq(urlStr: string) {
  const req = mockReq('GET')
  ;(req as any).nextUrl = new URL(urlStr)
  ;(req as any).url = urlStr
  return req
}

function mockDashboardTx() {
  const tx = makeTxMock({
    select: [
      { data: [{ total: 150000 }] },
      { data: [{ count: 5 }] },
      { data: [{ count: 3 }] },
      { data: [{ count: 2 }] },
      {
        data: [
          {
            id: 'order-1',
            customerEmail: 'test@test.com',
            total: 50000,
            status: 'confirmed',
            createdAt: new Date('2026-01-15'),
          },
        ],
        terminal: 'limit',
      },
      {
        data: [
          {
            id: 'prod-1',
            name: 'Producto Bajo Stock',
            sku: 'prod-1',
            stock: 3,
          },
        ],
        terminal: 'limit',
      },
    ],
  })
  tx.leftJoin = vi.fn().mockReturnValue(tx)
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/dashboard', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET(mockDashboardReq('http://localhost'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 400 when tenant not found in session', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {} as any,
      expires: '2099-01-01',
    })

    const response = await GET(mockDashboardReq('http://localhost'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Tenant no encontrado')
  })

  it('should return 400 for invalid query params', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await GET(
      mockDashboardReq('http://localhost?startDate=invalid'),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })

  it('should return metrics with correct structure', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockDashboardTx()),
    )

    const response = await GET(mockDashboardReq('http://localhost'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalRevenue).toBe(150000)
    expect(body.pendingOrders).toBe(5)
    expect(body.lowStockProducts).toBe(3)
    expect(body.outOfStockProducts).toBe(2)
    expect(body.recentOrders).toHaveLength(1)
    expect(body.recentOrders[0].customerName).toBe('test@test.com')
    expect(body.lowStockProductsList).toHaveLength(1)
    expect(body.lowStockProductsList[0].name).toBe('Producto Bajo Stock')
  })

  it('should use cents (integer) for revenue', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(mockDashboardTx()),
    )

    const response = await GET(mockDashboardReq('http://localhost'))
    const body = await response.json()

    expect(Number.isInteger(body.totalRevenue)).toBe(true)
  })
})

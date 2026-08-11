import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { makeTxMock, session, mockReq } from '@repo/test-utils'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

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
  return { ...actual, withTenantContext: vi.fn(), db: undefined }
})

import { auth } from '@/lib/auth'
import { GET, POST } from '../route'

const mockMethod = {
  id: 'method-1',
  tenantId: 'tenant-1',
  name: 'Envío estándar',
  description: '3 a 5 días hábiles',
  price: 15000,
  freeShippingThreshold: 200000,
  estimatedDaysMin: 3,
  estimatedDaysMax: 5,
  isActive: 'true',
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/shipping', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 200 with methods when authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [mockMethod], terminal: 'orderBy' }] })),
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.methods).toHaveLength(1)
    expect(body.methods[0].name).toBe('Envío estándar')
  })

  it('should return empty array when no methods configured', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'orderBy' }] })),
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.methods).toHaveLength(0)
  })
})

describe('POST /api/shipping', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await POST(mockReq('POST', { name: 'Envío', price: 150 }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 201 with created method when valid data', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock()
      tx.returning.mockResolvedValue([mockMethod])
      return cb(tx)
    })

    const response = await POST(
      mockReq('POST', { name: 'Envío estándar', price: 15000 }),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.method).toBeDefined()
    expect(body.method.name).toBe('Envío estándar')
  })

  it('should return 400 when name is empty', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await POST(mockReq('POST', { name: '', price: 150 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })

  it('should return 400 when price is negative', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await POST(mockReq('POST', { name: 'Envío', price: -10 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })
})

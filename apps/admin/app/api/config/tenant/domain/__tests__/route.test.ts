import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { mockReq, session } from '@repo/test-utils'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))
vi.mock('@repo/db', { db: undefined })

import { auth } from '@/lib/auth'
import { PUT } from '../route'

beforeEach(() => {
  vi.clearAllMocks()
})

function mockDbChain(data: any[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([data[0]]),
  }
  ;(db as any).select = chain.select
  ;(db as any).from = chain.from
  ;(db as any).where = chain.where
  ;(db as any).limit = chain.limit
  ;(db as any).update = chain.update
  ;(db as any).set = chain.set
  ;(db as any).returning = chain.returning
  return chain
}

describe('PUT /api/config/tenant/domain', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await PUT(mockReq('PUT', { customDomain: 'mitienda.com' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 400 when customDomain is invalid', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await PUT(
      mockReq('PUT', { customDomain: 'http://mitienda.com' }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })

  it('should return 404 when tenant not found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockDbChain([])

    const response = await PUT(mockReq('PUT', { customDomain: 'mitienda.com' }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Tenant no encontrado')
  })

  it('should return 409 when domain already in use', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const chain = mockDbChain([{ customDomain: 'other.com' }])
    chain.limit
      .mockResolvedValueOnce([{ customDomain: null }]) // current tenant exists
      .mockResolvedValueOnce([{ id: 'other-tenant' }]) // domain conflict check

    const response = await PUT(mockReq('PUT', { customDomain: 'mitienda.com' }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('El dominio ya está en uso')
    expect(body.field).toBe('customDomain')
  })

  it('should update domain successfully', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    const chain = mockDbChain([{ customDomain: null }])
    chain.limit.mockResolvedValueOnce([
      { id: 'tenant-1', slug: 'test', customDomain: 'mitienda.com' },
    ])
    ;(db as any).returning = vi
      .fn()
      .mockResolvedValue([
        { id: 'tenant-1', slug: 'test', customDomain: 'mitienda.com' },
      ])

    const response = await PUT(mockReq('PUT', { customDomain: 'mitienda.com' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.customDomain).toBe('mitienda.com')
  })

  it('should clear domain when empty string', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockDbChain([{ customDomain: 'old.com' }])
    ;(db as any).limit.mockResolvedValueOnce([{ customDomain: 'old.com' }])
    ;(db as any).returning = vi
      .fn()
      .mockResolvedValue([{ id: 'tenant-1', slug: 'test', customDomain: null }])

    const response = await PUT(mockReq('PUT', { customDomain: '' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.customDomain).toBeNull()
  })
})

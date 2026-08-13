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
import { GET, PUT, DELETE } from '../route'

const mockCategory = {
  id: 'cat-1',
  tenantId: 'tenant-1',
  name: 'Electrónica',
  slug: 'electronica',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const mockCategory2 = {
  id: 'cat-2',
  tenantId: 'tenant-1',
  name: 'Ropa',
  slug: 'ropa',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/categories/[id]', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 404 when category not found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'limit' }] })),
    )

    const response = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Categoría no encontrada')
  })

  it('should return category when found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [mockCategory], terminal: 'limit' }] })),
    )

    const response = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.category.id).toBe('cat-1')
    expect(body.category.name).toBe('Electrónica')
  })
})

describe('PUT /api/categories/[id]', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await PUT(mockReq('PUT', { name: 'Updated' }), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 404 when category not found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'limit' }] })),
    )

    const response = await PUT(mockReq('PUT', { name: 'Updated' }), {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Categoría no encontrada')
  })

  it('should return 400 when neither name nor slug provided', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [mockCategory], terminal: 'limit' }] })),
    )

    const response = await PUT(mockReq('PUT', {}), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Debe proporcionar al menos un campo')
  })

  it('should return 409 when regenerated slug already exists for another category', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock({
        select: [
          { data: [mockCategory], terminal: 'limit' },
          { data: [mockCategory2], terminal: 'limit' },
        ],
      })
      return cb(tx)
    })

    const response = await PUT(mockReq('PUT', { name: 'Ropa' }), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Ya existe una categoría con ese slug')
    expect(body.field).toBe('slug')
  })

  it('should update category successfully', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock({
        select: [
          { data: [mockCategory], terminal: 'limit' },
          { data: [], terminal: 'limit' },
        ],
      })
      return cb(tx)
    })

    const response = await PUT(
      mockReq('PUT', { name: 'Electrónica Pro', slug: 'electronica-pro' }),
      { params: Promise.resolve({ id: 'cat-1' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.category).toBeDefined()
  })
})

describe('DELETE /api/categories/[id]', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 404 when category not found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'limit' }] })),
    )

    const response = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Categoría no encontrada')
  })

  it('should return 409 when category has associated products', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock({
        select: [
          { data: [mockCategory], terminal: 'limit' },
          { data: [{ id: 'prod-1' }], terminal: 'limit' },
        ],
      })
      return cb(tx)
    })

    const response = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('La categoría tiene productos asociados')
  })

  it('should delete category successfully', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock({
        select: [
          { data: [mockCategory], terminal: 'limit' },
          { data: [], terminal: 'limit' },
        ],
      })
      return cb(tx)
    })

    const response = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })
})

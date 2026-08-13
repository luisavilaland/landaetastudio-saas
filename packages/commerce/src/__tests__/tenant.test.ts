import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

const mockSelect = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockWhere = vi.hoisted(() => vi.fn())
const mockLimit = vi.hoisted(() => vi.fn())

vi.mock('@repo/db', () => ({
  db: { select: mockSelect },
  dbTenants: { id: 'id', slug: 'slug' },
}))

import { getTenantId } from '../tenant'
import { headers } from 'next/headers'

describe('getTenantId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ limit: mockLimit })
  })

  it('should return tenant id when slug header is present', async () => {
    const mockHeaders = new Map([['x-tenant-slug', 'test-tenant']])
    vi.mocked(headers).mockResolvedValue(mockHeaders as any)
    mockLimit.mockResolvedValue([{ id: 'tenant-123' }])

    const result = await getTenantId()

    expect(result).toBe('tenant-123')
  })

  it('should return null when x-tenant-slug header is missing', async () => {
    const mockHeaders = new Map()
    vi.mocked(headers).mockResolvedValue(mockHeaders as any)

    const result = await getTenantId()

    expect(result).toBeNull()
  })

  it('should return null when x-tenant-slug is empty', async () => {
    const mockHeaders = new Map([['x-tenant-slug', '']])
    vi.mocked(headers).mockResolvedValue(mockHeaders as any)

    const result = await getTenantId()

    expect(result).toBeNull()
  })

  it('should return null when tenant slug does not match any tenant', async () => {
    const mockHeaders = new Map([['x-tenant-slug', 'nonexistent']])
    vi.mocked(headers).mockResolvedValue(mockHeaders as any)
    mockLimit.mockResolvedValue([])

    const result = await getTenantId()

    expect(result).toBeNull()
  })
})

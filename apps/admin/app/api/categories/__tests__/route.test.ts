import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { makeTxMock, session, mockReq } from '@repo/test-utils'
// S4c/item 103: se mockea `getPermissions` (la FUENTE), no el guard.
// El endpoint sigue llamando al guard REAL, asi que el cableado se verifica
// en cada test: si alguien borra la linea del guard, el 403 no aparece.
vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return { ...actual, getPermissions: vi.fn() }
})


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
import { getPermissions } from '@repo/commerce'

const mockCategory = {
  id: 'cat-1',
  tenantId: 'tenant-1',
  name: 'Electrónica',
  slug: 'electronica',
  createdAt: new Date(),
  updatedAt: new Date(),
}


/** Tenant `active` + suscripcion `active`: todo permitido. */
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
  vi.clearAllMocks()
  // Por defecto el tenant tiene acceso; los tests que niegan lo sobreescriben.
  vi.mocked(getPermissions).mockResolvedValue(FULL_ACCESS)
})

describe('GET /api/categories', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return categories list for authenticated tenant', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(
        makeTxMock({ select: [{ data: [mockCategory], terminal: 'orderBy' }] }),
      ),
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(1)
    expect(body.categories[0].name).toBe('Electrónica')
  })

  it('should return empty list when no categories exist', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'orderBy' }] })),
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.categories).toHaveLength(0)
  })
})

describe('POST /api/categories', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await POST(mockReq('POST', { name: 'Test', slug: 'test' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 400 when name is missing', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await POST(mockReq('POST', { slug: 'test' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })

  it('should return 400 when slug is missing', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await POST(mockReq('POST', { name: 'Test' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })

  it('should return 409 when slug already exists for tenant', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [mockCategory], terminal: 'limit' }] })),
    )

    const response = await POST(
      mockReq('POST', { name: 'Electrónica', slug: 'electronica' }),
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Ya existe una categoría con ese slug')
    expect(body.field).toBe('slug')
  })

  it('should create category successfully', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'limit' }] })),
    )

    const response = await POST(
      mockReq('POST', { name: 'Electrónica', slug: 'electronica' }),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.category).toBeDefined()
  })
})

describe('S4c / item 103 — el guard IMPONE', () => {
  it('deniega cuando falta el permiso', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    // sin canWrite: el guard tiene que responder 403
    vi.mocked(getPermissions).mockResolvedValue({
      ...FULL_ACCESS,
      canWrite: false,
      canSell: false,
      canAccessPanel: 'none',
    })

    const response = await POST(
      mockReq('POST', JSON.stringify({ name: 'X', slug: 'x-slug' })),
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.permission).toBe('canWrite')
  })
})

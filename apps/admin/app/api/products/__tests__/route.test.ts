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

vi.mock('@repo/storage', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://cdn.example.com/img.png'),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return {
    ...actual,
    withTenantContext: vi.fn(),
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      transaction: vi.fn(),
    },
  }
})

// S4c/item 103: se mockea `getPermissions` (la FUENTE), no `denyIfNoPermission`.
//
// Asi el endpoint sigue llamando al guard REAL y el cableado se verifica en
// cada test: si alguien borra la linea del guard, el 403 no aparece y el test
// falla. Mockear el guard entero dejaria el cableado sin cubrir.
vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return { ...actual, getPermissions: vi.fn() }
})

import { auth } from '@/lib/auth'
import { getPermissions } from '@repo/commerce'
import { GET, POST } from '../route'

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

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.append(key, value)
  }
  return fd
}

function mockReqForm(method: string, formData: FormData) {
  return {
    json: async () => ({}),
    text: async () => '',
    formData: async () => formData,
    headers: new Headers({ 'content-type': 'multipart/form-data' }),
    nextUrl: new URL('http://localhost'),
    cookies: { get: vi.fn() },
    method,
  } as any
}

const NOW = new Date('2026-01-01T00:00:00.000Z')
const baseProduct = {
  id: 'prod-1',
  tenantId: 'tenant-1',
  categoryId: null,
  name: 'Producto Test',
  slug: 'producto-test',
  description: null,
  imageUrl: null,
  status: 'draft',
  metadata: {},
  createdAt: NOW,
  updatedAt: NOW,
}

beforeEach(() => {
  vi.clearAllMocks()
  // Por defecto el tenant puede publicar. Los tests que necesitan denegar lo
  // sobreescriben esto.
  vi.mocked(getPermissions).mockResolvedValue(FULL_ACCESS)
})

describe('S4c / item 103 — el guard IMPONE canWrite', () => {
  /** `past_due`: vende pero no publica (D17). */
  const PAST_DUE = { ...FULL_ACCESS, canWrite: false, canSell: true }

  it('un tenant past_due NO puede crear productos (403)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(getPermissions).mockResolvedValue(PAST_DUE)
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'where' }] })),
    )

    const response = await POST(
      mockReq(
        'POST',
        makeFormData({
          name: 'Producto',
          slug: 'producto',
          description: 'x',
          categoryId: '',
          price: '1000',
          stock: '1',
        }),
      ),
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.permission).toBe('canWrite')
  })

  it('un tenant pending_first_payment NO puede crear productos (403)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(getPermissions).mockResolvedValue({
      ...FULL_ACCESS,
      canWrite: false,
      canSell: false,
      canAccessPanel: 'readonly',
    })
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'where' }] })),
    )

    const response = await POST(
      mockReq(
        'POST',
        makeFormData({
          name: 'Producto',
          slug: 'producto',
          description: 'x',
          categoryId: '',
          price: '1000',
          stock: '1',
        }),
      ),
    )

    expect(response.status).toBe(403)
  })

  it('un tenant suspended NO puede crear productos (403)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(getPermissions).mockResolvedValue({
      ...FULL_ACCESS,
      canWrite: false,
      canSell: false,
      canAccessPanel: 'none',
    })
    vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'where' }] })),
    )

    const response = await POST(
      mockReq(
        'POST',
        makeFormData({
          name: 'Producto',
          slug: 'producto',
          description: 'x',
          categoryId: '',
          price: '1000',
          stock: '1',
        }),
      ),
    )

    expect(response.status).toBe(403)
  })
})

describe('GET /api/products', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return products list with images for authenticated tenant', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(
        makeTxMock({
          select: [
            { data: [baseProduct] },
            {
              data: [
                {
                  id: 'img-1',
                  productId: 'prod-1',
                  url: 'https://cdn.example.com/img.png',
                  position: 0,
                },
              ],
              terminal: 'orderBy',
            },
          ],
        }),
      ),
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.products).toHaveLength(1)
    expect(body.products[0].name).toBe('Producto Test')
    expect(body.products[0].images).toHaveLength(1)
  })

  it('should return empty list when no products exist', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(
        makeTxMock({
          select: [{ data: [] }, { data: [], terminal: 'orderBy' }],
        }),
      ),
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.products).toHaveLength(0)
  })
})

describe('POST /api/products', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const fd = makeFormData({
      name: 'Test',
      slug: 'test',
      price: '1999',
      stock: '10',
    })
    const response = await POST(mockReqForm('POST', fd))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 400 when required fields missing', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await POST(mockReqForm('POST', new FormData()))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })

  it('should return 409 when slug already exists', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock({
        select: [{ data: [baseProduct], terminal: 'limit' }],
      })
      return cb(tx)
    })

    const fd = makeFormData({
      name: 'Producto Test',
      slug: 'producto-test',
      price: '1999',
      stock: '10',
    })
    const response = await POST(mockReqForm('POST', fd))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Ya existe un producto con ese slug')
  })

  it('should create product successfully', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock({
        select: [
          { data: [], terminal: 'limit' },
          {
            data: [
              {
                id: 'v1',
                productId: 'new-prod',
                sku: 'nuevo-producto',
                price: 2999,
                stock: 5,
                options: {},
                createdAt: NOW,
                updatedAt: NOW,
              },
            ],
            terminal: 'where',
          },
        ],
      })
      tx.returning.mockResolvedValue([
        {
          id: 'new-prod',
          tenantId: 'tenant-1',
          name: 'Nuevo Producto',
          slug: 'nuevo-producto',
          description: null,
          imageUrl: null,
          status: 'draft',
          categoryId: null,
          metadata: {},
          createdAt: NOW,
          updatedAt: NOW,
        },
      ])
      return cb(tx)
    })

    const fd = makeFormData({
      name: 'Nuevo Producto',
      slug: 'nuevo-producto',
      price: '2999',
      stock: '5',
    })
    const response = await POST(mockReqForm('POST', fd))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.product).toBeDefined()
    expect(body.product.name).toBe('Nuevo Producto')
  })
})

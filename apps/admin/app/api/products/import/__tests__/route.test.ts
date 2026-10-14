import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { makeTxMock, session } from '@repo/test-utils'
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
import { POST } from '../route'
import { getPermissions } from '@repo/commerce'

function makeImportReq(csvContent: string | null) {
  const fd = new FormData()
  if (csvContent !== null) {
    const file = new File([csvContent], 'products.csv', { type: 'text/csv' })
    fd.append('file', file)
  }
  return {
    json: async () => ({}),
    text: async () => csvContent ?? '',
    formData: async () => fd,
    headers: new Headers({ 'content-type': 'multipart/form-data' }),
    nextUrl: new URL('http://localhost'),
    url: 'http://localhost',
    cookies: { get: vi.fn() },
    method: 'POST',
  } as any
}

const validCSV = `name,slug,description,price,stock,status,category_slug,sku
Remera Básica,remera-basica,Remera de algodón,2500,10,active,remeras,remera-001
Pantalón Jeans,pantalon-jeans,Jeans clásico,5000,5,active,pantalones,jeans-001`

const csvMissingColumns = `name,description
Remera,Descripción`


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

/**
 * El guard (S4c/item 103) abre su propia transaccion ANTES que el handler, asi
 * que consume la primera entrada de la cola. `getPermissions` esta mockeado y
 * no usa el tx, asi que este valor es irrelevante: solo tiene que existir.
 */
const GUARD_TX = makeTxMock()

beforeEach(() => {
  vi.clearAllMocks()
  // Por defecto el tenant tiene acceso; los tests que niegan lo sobreescriben.
  vi.mocked(getPermissions).mockResolvedValue(FULL_ACCESS)
  // El guard (S4c) abre su propia transaccion antes que el handler. Sin este default el
  // mock devuelve undefined y el guard revienta con TypeError en vez de devolver 403.
  vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(makeTxMock()))
})

describe('POST /api/products/import', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await POST(makeImportReq(validCSV))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 400 when no file provided', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await POST(makeImportReq(null))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('No se proporcionó un archivo CSV')
  })

  it('should return 400 when CSV missing required columns', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const response = await POST(makeImportReq(csvMissingColumns))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('columnas')
  })

  it('should create products from valid CSV', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    let callCount = 0
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      callCount++
      if (callCount === 2) {
        const tx = makeTxMock({
          select: [
            {
              data: [
                { id: 'cat-1', slug: 'remeras', tenantId: 'tenant-1' },
                { id: 'cat-2', slug: 'pantalones', tenantId: 'tenant-1' },
              ],
            },
          ],
        })
        return cb(tx)
      }
      const tx = makeTxMock({
        select: [{ data: [], terminal: 'limit' }],
        repeatLastSelect: true,
      })
      tx.returning.mockResolvedValue([{ id: `prod-${callCount}` }])
      return cb(tx)
    })

    const response = await POST(makeImportReq(validCSV))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.created).toBe(2)
    expect(body.summary.errors).toBe(0)
  })

  it('should skip products with duplicate slug', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    let callCount = 0
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      callCount++
      if (callCount === 2) {
        const tx = makeTxMock({
          select: [
            {
              data: [
                { id: 'cat-1', slug: 'remeras', tenantId: 'tenant-1' },
                { id: 'cat-2', slug: 'pantalones', tenantId: 'tenant-1' },
              ],
            },
          ],
        })
        return cb(tx)
      }
      const existing = callCount === 3 ? [{}] : []
      const tx = makeTxMock({
        select: [{ data: existing, terminal: 'limit' }],
        repeatLastSelect: true,
      })
      tx.returning.mockResolvedValue([{ id: `prod-${callCount}` }])
      return cb(tx)
    })

    const response = await POST(makeImportReq(validCSV))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.skipped).toBe(1)
    expect(body.summary.created).toBe(1)
    expect(body.results[0].status).toBe('skipped')
    expect(body.results[0].reason).toContain('ya existe')
  })

  it('should return error for invalid price', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [] }] })),
    )

    const csv = `name,price,stock\nRemera,-100,10`
    const response = await POST(makeImportReq(csv))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.errors).toBe(1)
    expect(body.results[0].reason).toContain('Precio inválido')
  })

  it('should return error for invalid stock', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [] }] })),
    )

    const csv = `name,price,stock\nRemera,2500,-5`
    const response = await POST(makeImportReq(csv))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.errors).toBe(1)
    expect(body.results[0].reason).toContain('Stock inválido')
  })

  it('should return error for missing name', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock({ select: [{ data: [] }] })),
    )

    const csv = `name,price,stock\n,2500,10`
    const response = await POST(makeImportReq(csv))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.errors).toBe(1)
    expect(body.results[0].reason).toContain('Nombre requerido')
  })

  it('should return error for invalid category', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    let catCallCount = 0
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      catCallCount++
      // La llamada 1 es la del guard (S4c), que corre antes que el handler.
      const tx =
        catCallCount === 2
          ? makeTxMock({ select: [{ data: [] }] })
          : makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
      return cb(tx)
    })

    const csv = `name,price,stock,category_slug\nRemera,2500,10,inexistente`
    const response = await POST(makeImportReq(csv))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.skipped).toBe(1)
    expect(body.results[0].reason).toContain('Categoría')
  })

  it('should auto-generate slug from name if not provided', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    let callCount = 0
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      callCount++
      if (callCount === 2) {
        return cb(makeTxMock({ select: [{ data: [] }] }))
      }
      const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
      tx.returning.mockResolvedValue([{ id: 'new-prod' }])
      return cb(tx)
    })

    const csv = `name,price,stock\nRemera Básica Ñoña,2500,10`
    const response = await POST(makeImportReq(csv))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.created).toBe(1)
    expect(body.results[0].status).toBe('created')
  })

  it('should handle mixed results correctly', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    let callCount = 0
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      callCount++
      if (callCount === 2) {
        return cb(makeTxMock({ select: [{ data: [] }] }))
      }
      const existing = callCount === 4 ? [{}] : []
      const tx = makeTxMock({
        select: [{ data: existing, terminal: 'limit' }],
        repeatLastSelect: true,
      })
      tx.returning.mockResolvedValue([{ id: `prod-${callCount}` }])
      return cb(tx)
    })

    const csv = `name,price,stock\nProducto OK,2500,10\n,500,5\nDuplicado,1000,3`
    const response = await POST(makeImportReq(csv))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.total).toBe(3)
    expect(body.summary.created).toBe(1)
    expect(body.summary.skipped).toBe(1)
    expect(body.summary.errors).toBe(1)
  })
})

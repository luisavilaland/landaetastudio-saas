import { describe, it, expect, vi, beforeEach } from 'vitest'
// S4c/item 103: se mockea getPermissions (la FUENTE), no el guard.
// El endpoint sigue llamando al guard REAL: si alguien borra la linea del
// guard, el 403 no aparece y el test falla.
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

vi.mock('@repo/storage', () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn() }
})

import { withTenantContext } from '@repo/db'
import { makeTxMock, session, mockReq } from '@repo/test-utils'
import { auth } from '@/lib/auth'
import { uploadImage, deleteImage } from '@repo/storage'
import { GET, POST } from '../route'
import { DELETE } from '../[imageId]/route'
import { getPermissions } from '@repo/commerce'

/**
 * El guard (S4c/item 103) abre su propia transaccion ANTES que el handler, asi
 * que consume la primera entrada de la cola. `getPermissions` esta mockeado y
 * no usa el tx, asi que este valor es irrelevante: solo tiene que existir.
 */
const GUARD_TX = makeTxMock()

/** Tenant active + suscripcion active: todo permitido. */
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
  vi.mocked(getPermissions).mockResolvedValue(FULL_ACCESS)
  // El guard (S4c) abre su propia transaccion antes que el handler. Sin este default el
  // mock devuelve undefined y el guard revienta con TypeError en vez de devolver 403.
  vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(makeTxMock()))
})


const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'
const PRODUCT_ID = 'prod-1'
const PRODUCT_SLUG = 'test-product'
const IMAGE_ID = 'img-1'

describe('GET /api/products/[id]/images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('should return 404 when product not found', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx))
    const res = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_A,
      expect.any(Function),
    )
  })

  it('should return images when product exists', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    const tx = makeTxMock({
      select: [
        { data: [{ id: PRODUCT_ID, tenantId: TENANT_A }], terminal: 'limit' },
        {
          data: [
            {
              id: IMAGE_ID,
              productId: PRODUCT_ID,
              url: 'http://img.url',
              position: 0,
            },
          ],
          terminal: 'orderBy',
        },
      ],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx))
    const res = await GET(mockReq('GET'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.images).toHaveLength(1)
  })
})

describe('POST /api/products/[id]/images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await POST(mockReq('POST'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('should return 404 when product not found', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx))
    const res = await POST(mockReq('POST'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_A,
      expect.any(Function),
    )
  })

  it('should return 400 when no image provided', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    const tx = makeTxMock({
      select: [
        {
          data: [
            {
              id: PRODUCT_ID,
              tenantId: TENANT_A,
              slug: PRODUCT_SLUG,
              name: 'Test',
            },
          ],
          terminal: 'limit',
        },
      ],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx))
    const res = await POST(mockReq('POST'), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('should upload image and return 201', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    vi.mocked(uploadImage).mockResolvedValue('http://minio/img.png')

    const productTx = makeTxMock({
      select: [
        {
          data: [
            {
              id: PRODUCT_ID,
              tenantId: TENANT_A,
              slug: PRODUCT_SLUG,
              name: 'Test Product',
            },
          ],
          terminal: 'limit',
        },
      ],
    })
    const insertTx = makeTxMock()
    insertTx.select.mockReturnValue(insertTx)
    insertTx.from.mockReturnValue(insertTx)
    insertTx.where.mockReturnValue(insertTx)
    insertTx.orderBy.mockResolvedValue([])
    insertTx.insert.mockReturnValue(insertTx)
    insertTx.values.mockReturnValue(insertTx)
    insertTx.returning.mockResolvedValue([
      {
        id: IMAGE_ID,
        productId: PRODUCT_ID,
        url: 'http://minio/img.png',
        position: 0,
      },
    ])

    const mockCalls = [GUARD_TX, productTx, insertTx]
    let callIndex = 0
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) =>
      cb(mockCalls[callIndex++]),
    )

    const fd = new FormData()
    fd.append('image', new File(['data'], 'test.png', { type: 'image/png' }))
    const res = await POST(mockReq('POST', fd), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })

    expect(res.status).toBe(201)
    expect(withTenantContext).toHaveBeenCalledTimes(3)
  })

  it('should return 409 when FK violation on insert (product deleted between contexts)', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    vi.mocked(uploadImage).mockResolvedValue('http://minio/img.png')

    const productTx = makeTxMock({
      select: [
        {
          data: [
            {
              id: PRODUCT_ID,
              tenantId: TENANT_A,
              slug: PRODUCT_SLUG,
              name: 'Test Product',
            },
          ],
          terminal: 'limit',
        },
      ],
    })
    const insertTx = makeTxMock()
    insertTx.select.mockReturnValue(insertTx)
    insertTx.from.mockReturnValue(insertTx)
    insertTx.where.mockReturnValue(insertTx)
    insertTx.orderBy.mockResolvedValue([])
    insertTx.insert.mockReturnValue(insertTx)
    insertTx.values.mockReturnValue(insertTx)
    insertTx.returning.mockRejectedValue({ code: '23503' })

    const mockCalls = [GUARD_TX, productTx, insertTx]
    let callIndex = 0
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) =>
      cb(mockCalls[callIndex++]),
    )

    const fd = new FormData()
    fd.append('image', new File(['data'], 'test.png', { type: 'image/png' }))
    const res = await POST(mockReq('POST', fd), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Producto no encontrado')
  })
})

describe('DELETE /api/products/[id]/images/[imageId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('should return 404 when image not found', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx))
    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('should return 404 when image belongs to different product', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    const tx = makeTxMock({
      select: [
        {
          data: [
            {
              id: IMAGE_ID,
              tenantId: TENANT_A,
              productId: 'other-prod',
              url: 'http://img.url',
            },
          ],
          terminal: 'limit',
        },
      ],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx))
    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('should delete image and return 200', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    vi.mocked(deleteImage).mockResolvedValue(undefined)

    const readTx = makeTxMock({
      select: [
        {
          data: [
            {
              id: IMAGE_ID,
              tenantId: TENANT_A,
              productId: PRODUCT_ID,
              url: 'http://minio/products/prod-1/img.png',
            },
          ],
          terminal: 'limit',
        },
      ],
    })
    const deleteTx = makeTxMock()
    deleteTx.delete.mockReturnValue(deleteTx)
    deleteTx.where.mockResolvedValue(undefined)

    const mockCalls = [GUARD_TX, readTx, deleteTx]
    let callIndex = 0
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) =>
      cb(mockCalls[callIndex++]),
    )

    const res = await DELETE(mockReq('DELETE'), {
      params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }),
    })

    expect(res.status).toBe(200)
    expect(deleteImage).toHaveBeenCalled()
    expect(withTenantContext).toHaveBeenCalledTimes(3)
  })
})

/**
 * Item 117 / H-F3-s4c-1: cobertura de denegacion para el guard de POST.
 *
 * Este archivo reservaba un slot de transaccion para el guard (indice 0 de
 * `mockCalls`), y por eso borrar el guard producia un 500 en vez de una senal
 * util: el handler recibia la tx del guard en lugar de la suya. Los happy paths
 * de arriba ya no reservan ese slot.
 *
 * En el deny test la secuencia es la **del handler, sin slot para el guard**.
 * Con el guard presente nunca se llega al handler, asi que da 403; si el guard
 * desapareciera, el handler recibiria sus dos transacciones y responderia 201.
 * Por eso el assert falla con 201 y no con un 500.
 */
describe('S4c / item 117 — el guard IMPONE (POST)', () => {
  it('POST /api/products/[id]/images devuelve 403 sin canWrite', async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A))
    vi.mocked(uploadImage).mockResolvedValue('http://minio/img.png')
    vi.mocked(getPermissions).mockResolvedValue({
      ...FULL_ACCESS,
      canWrite: false,
      canSell: false,
      canAccessPanel: 'none',
    })

    // Una sola tx auto-encadenada que sirve TANTO la lectura del producto como
    // el insert de la imagen. Asi el test no depende de cuantas veces se abrió
    // una transaccion antes: con el guard presente responde 403 sin llegar al
    // handler; si el guard desapareciera, el handler recibe esta misma tx para
    // las dos operaciones y responde 201. El assert falla con 201, no con 500.
    const unifiedTx = makeTxMock({
      select: [
        // 1. lectura del producto (`.limit(1)`)
        {
          data: [
            {
              id: PRODUCT_ID,
              tenantId: TENANT_A,
              slug: PRODUCT_SLUG,
              name: 'Test Product',
            },
          ],
          terminal: 'limit',
        },
        // 2. imagenes existentes del producto (`.orderBy(position)`)
        { data: [], terminal: 'orderBy' },
      ],
      repeatLastSelect: true,
    })
    unifiedTx.insert.mockReturnValue(unifiedTx)
    unifiedTx.values.mockReturnValue(unifiedTx)
    unifiedTx.from.mockReturnValue(unifiedTx)
    unifiedTx.where.mockReturnValue(unifiedTx)
    // El handler consulta las imagenes existentes para calcular la posicion;
    // sin esto el insert se rompe con un TypeError y el handler devuelve 500.
    unifiedTx.orderBy.mockResolvedValue([])
    unifiedTx.returning.mockResolvedValue([
      {
        id: IMAGE_ID,
        productId: PRODUCT_ID,
        url: 'http://minio/img.png',
        position: 0,
      },
    ])

    vi.mocked(withTenantContext).mockImplementation(async (_, cb) =>
      cb(unifiedTx),
    )

    const fd = new FormData()
    fd.append('image', new File(['data'], 'test.png', { type: 'image/png' }))
    const res = await POST(mockReq('POST', fd), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })

    // Status antes que body: si el status no es 403 no hay nada que leer del
    // body, y leerlo primero convertiria un 201 en un 500 del catch.
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.permission).toBe('canWrite')
    expect(body.error).toBe('La suscripción no permite publicar contenido')
  })
})

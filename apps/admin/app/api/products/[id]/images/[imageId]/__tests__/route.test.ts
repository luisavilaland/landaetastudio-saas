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
  }),
}))
vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: undefined }
})
vi.mock('@repo/storage', () => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
}))

import { auth } from '@/lib/auth'
import { DELETE } from '../route'
import { getPermissions } from '@repo/commerce'

function makeReq() {
  return {
    json: async () => ({}),
    text: async () => '',
    headers: new Headers(),
    nextUrl: new URL('http://localhost'),
    url: 'http://localhost',
    cookies: { get: vi.fn() },
    method: 'DELETE',
  } as any
}

const mockImage = {
  id: 'img-1',
  productId: 'prod-1',
  tenantId: 'tenant-1',
  url: 'https://storage.com/products/prod-1/image.jpg',
  alt: 'Product image',
  position: 0,
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

describe('DELETE /api/products/[id]/images/[imageId]', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'prod-1', imageId: 'img-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('should return 404 when image not found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: 'limit' }] })),
    )

    const response = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'prod-1', imageId: 'img-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Imagen no encontrada')
  })

  it('should return 404 when image does not belong to product', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(
        makeTxMock({
          select: [
            {
              data: [{ ...mockImage, productId: 'other-prod' }],
              terminal: 'limit',
            },
          ],
        }),
      ),
    )

    const response = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'prod-1', imageId: 'img-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Imagen no encontrada')
  })

    it('should delete image successfully', async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      // Item 117: sin contador. Antes este mock reservaba la transaccion #1
      // para el guard y entregaba la del handler en la #2, asi que borrar el
      // guard hacia que el handler recibiera una tx vacia y respondiera 500.
      // Devolver siempre la misma tx hace el test independiente de que el
      // guard exista: el guard se queda con la primera, pero como
      // `getPermissions` esta mockeado no le importa.
      vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
        cb(makeTxMock({ select: [{ data: [mockImage], terminal: 'limit' }] })),
      )

      const { deleteImage } = await import('@repo/storage')

    const response = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'prod-1', imageId: 'img-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(deleteImage).toHaveBeenCalledWith('products/prod-1/image.jpg')
  })
})

/**
 * Item 117 / H-F3-s4c-1: cobertura de denegacion para el guard de DELETE.
 *
 * Este archivo reservaba un slot de transaccion para el guard (el `callCount`
 * de arriba), y por eso borrar el guard producia un 500 en vez de una senal
 * util: el handler recibia la tx del guard en lugar de la suya.
 *
 * Aca el mock devuelve SIEMPRE la tx del happy path, sin contador. El guard
 * abre su propia transaccion y se queda con la primera, pero como
 * `getPermissions` esta mockeado no le importa cual recibe. Con guard responde
 * 403; sin guard el handler completa y responde 200, y el assert falla con 200.
 */
describe('S4c / item 117 — el guard IMPONE (DELETE)', () => {
  it('DELETE /api/products/[id]/images/[imageId] devuelve 403 sin canWrite', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    vi.mocked(getPermissions).mockResolvedValue({
      ...FULL_ACCESS,
      canWrite: false,
      canSell: false,
      canAccessPanel: 'none',
    })
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTxMock({ select: [{ data: [mockImage], terminal: 'limit' }] })),
    )

    const response = await DELETE(makeReq(), {
      params: Promise.resolve({ id: 'prod-1', imageId: 'img-1' }),
    })

    // Status antes que body: leer el body primero convertiria un 200 en un 500.
    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.permission).toBe('canWrite')
    expect(body.error).toBe('La suscripción no permite publicar contenido')
  })
})

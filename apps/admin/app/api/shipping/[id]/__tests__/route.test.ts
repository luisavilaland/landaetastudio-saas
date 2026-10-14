import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ShippingMethod } from '@repo/db'
import { withTenantContext } from '@repo/db'
import { makeTxMock } from '@repo/test-utils'
// S4c/item 103: se mockea getPermissions (la FUENTE), no el guard.
// El endpoint sigue llamando al guard REAL: si alguien borra la linea del
// guard, el 403 no aparece y el test falla.
//
// Item 117: este archivo tambien necesita la cobertura de denegacion de PUT y
// DELETE. Antes el header prometia un assert de 403 que el archivo no tenia
// (H-F3-s4c-4): los tests de exito pasaban igual con el guard borrado, porque
// nadie comprobaba que el guard estuviera. Los deny tests de abajo asertean
// 403 real y el mensaje del permiso.
vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return { ...actual, getPermissions: vi.fn() }
})


vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: { transaction: vi.fn() } }
})

import { auth } from '@/lib/auth'
import { GET, PUT, DELETE } from '../route'
import { getPermissions } from '@repo/commerce'
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
})


function makeGETRequest(id: string) {
  return GET(
    {
      nextUrl: new URL('http://localhost'),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof GET>[0],
    { params: Promise.resolve({ id }) },
  )
}

function makePUTRequest(id: string, body: Record<string, unknown>) {
  return PUT(
    {
      json: async () => body,
      nextUrl: new URL('http://localhost'),
      cookies: { get: () => undefined },
      headers: new Headers(),
    } as unknown as Parameters<typeof PUT>[0],
    { params: Promise.resolve({ id }) },
  )
}

function makeDELETERequest(id: string) {
  return DELETE(
    {
      nextUrl: new URL('http://localhost'),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof DELETE>[0],
    { params: Promise.resolve({ id }) },
  )
}

const mockId = 'shipping-test-id'
const sessionTenant = 'tenant-a'
const otherTenant = 'tenant-b'

const mockMethod: ShippingMethod = {
  id: mockId,
  tenantId: sessionTenant,
  name: 'Standard Shipping',
  description: 'Standard delivery',
  price: 500,
  freeShippingThreshold: 50000,
  estimatedDaysMin: 3,
  estimatedDaysMax: 7,
  isActive: 'true',
  sortOrder: 1,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
}

describe('GET /api/shipping/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock()),
    )
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await makeGETRequest(mockId)
    expect(res.status).toBe(401)
  })

  it('should return 404 for cross-tenant access', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: otherTenant, email: 'admin@b.com' },
    })

    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makeGETRequest(mockId)
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      otherTenant,
      expect.any(Function),
    )
  })

  it('should return 200 with method', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })

    const tx = makeTxMock({
      select: [{ data: [mockMethod], terminal: 'limit' }],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makeGETRequest(mockId)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.method.id).toBe(mockId)
    expect(data.method.name).toBe('Standard Shipping')
    expect(data.method.price).toBe(500)
    expect(withTenantContext).toHaveBeenCalledWith(
      sessionTenant,
      expect.any(Function),
    )
  })
})

describe('PUT /api/shipping/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock()),
    )
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await makePUTRequest(mockId, { name: 'Express' })
    expect(res.status).toBe(401)
  })

  it('should return 404 for cross-tenant access', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: otherTenant, email: 'admin@b.com' },
    })

    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makePUTRequest(mockId, { name: 'Express' })
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      otherTenant,
      expect.any(Function),
    )
  })

  it('should return 400 for invalid body', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })

    const tx = makeTxMock({
      select: [{ data: [mockMethod], terminal: 'limit' }],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makePUTRequest(mockId, { price: -100 })
    expect(res.status).toBe(400)
    expect(withTenantContext).toHaveBeenCalledWith(
      sessionTenant,
      expect.any(Function),
    )
  })

  it('should return 200 on successful update', async () => {
    const updatedMethod = { ...mockMethod, name: 'Express Shipping' }

    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })

    const tx = makeTxMock({
      select: [{ data: [mockMethod], terminal: 'limit' }],
    })
    tx.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedMethod]),
        }),
      }),
    } as ReturnType<typeof db.update>)
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makePUTRequest(mockId, { name: 'Express Shipping' })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.method.name).toBe('Express Shipping')
    expect(withTenantContext).toHaveBeenCalledWith(
      sessionTenant,
      expect.any(Function),
    )
  })
})

describe('DELETE /api/shipping/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(makeTxMock()),
    )
  })

  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await makeDELETERequest(mockId)
    expect(res.status).toBe(401)
  })

  it('should return 404 for cross-tenant access', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: otherTenant, email: 'admin@b.com' },
    })

    const tx = makeTxMock({ select: [{ data: [], terminal: 'limit' }] })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makeDELETERequest(mockId)
    expect(res.status).toBe(404)
    expect(withTenantContext).toHaveBeenCalledWith(
      otherTenant,
      expect.any(Function),
    )
  })

  it('should return 204 on successful delete', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })

    const tx = makeTxMock({
      select: [{ data: [mockMethod], terminal: 'limit' }],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

      const res = await makeDELETERequest(mockId)
      expect(res.status).toBe(204)
      expect(withTenantContext).toHaveBeenCalledWith(
        sessionTenant,
        expect.any(Function),
      )
    })
  })

/**
 * Item 117 / H-F3-s4c-1: cobertura de denegacion para los guards de PUT y
 * DELETE. Antes este archivo no tenia ni un assert de 403.
 *
 * El mock de `withTenantContext` devuelve SIEMPRE la tx del happy path, sin
 * reservar un slot para el guard. El guard abre su propia transaccion y se
 * queda con la primera, pero como `getPermissions` esta mockeado no le importa
 * cual recibe. Con guard responde 403; sin guard el handler completa y
 * responde 200/204, y el assert falla con ese status en vez de con un 500.
 */
describe('S4c / item 117 — el guard IMPONE (PUT, DELETE)', () => {
  const DENY_WRITE = {
    ...FULL_ACCESS,
    canWrite: false,
    canSell: false,
    canAccessPanel: 'none',
  }

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: 'admin@test.com' },
    })
  })

  it('PUT /api/shipping/[id] devuelve 403 sin canWrite', async () => {
    vi.mocked(getPermissions).mockResolvedValue(DENY_WRITE)

    const updatedMethod = { ...mockMethod, name: 'Express Shipping' }
    const tx = makeTxMock({
      select: [{ data: [mockMethod], terminal: 'limit' }],
    })
    tx.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedMethod]),
        }),
      }),
    } as ReturnType<typeof db.update>)
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makePUTRequest(mockId, { name: 'Express Shipping' })

    // Status antes que body: un DELETE exitoso responde 204 sin cuerpo y
    // `res.json()` ahi tiraria, tapando la senal con un 500.
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.permission).toBe('canWrite')
    expect(body.error).toBe('La suscripción no permite publicar contenido')
  })

  it('DELETE /api/shipping/[id] devuelve 403 sin canWrite', async () => {
    vi.mocked(getPermissions).mockResolvedValue(DENY_WRITE)

    const tx = makeTxMock({
      select: [{ data: [mockMethod], terminal: 'limit' }],
    })
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
      cb(tx),
    )

    const res = await makeDELETERequest(mockId)

    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.permission).toBe('canWrite')
    expect(body.error).toBe('La suscripción no permite publicar contenido')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { uploadImage } from '@repo/storage'
import { auth } from '@/lib/auth'
import { mockReq } from '@repo/test-utils'

/**
 * T11 / D16: branding basico.
 *
 * Tests con `withTenantContext` mockeado (el patron del repo para handlers): lo
 * que se verifica aca es el **contrato del endpoint** - validacion, degradacion
 * y forma de la escritura - no la fila real. El `WHERE` de la escritura vive en
 * la funcion de dominio por el mismo motivo que en `activateTenant`.
 */

// `vi.mock` se hoistea por encima de los `const`, asi que lo que el factory
// referencia tiene que existir en `vi.hoisted()`.
const { authMock, loggerWarn, loggerError } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))

vi.mock('@repo/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: loggerWarn,
    error: loggerError,
    debug: vi.fn(),
  }),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn() }
})

vi.mock('@repo/storage', () => ({ uploadImage: vi.fn() }))

import { POST } from '../route'

/** Captura los `values` del unico `tx.update(...).set(...)` que hace el endpoint. */
function spyTx(options: { returning?: unknown[] } = {}) {
  const updates: Array<Record<string, unknown>> = []
  const where = vi.fn(() => ({
    returning: vi.fn(() =>
      Promise.resolve(options.returning ?? [{ id: 'tenant-1' }]),
    ),
  }))
  const tx = {
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values)
        return { where }
      },
    })),
  }
  return { tx, updates }
}

function brandingReq(file: unknown, headers: Record<string, string> = {}) {
  const form = new FormData()
  if (file !== undefined) form.append('logo', file as Blob)
  const req = mockReq('POST', form)
  for (const [k, v] of Object.entries(headers)) req.headers.set(k, v)
  return req as unknown as Parameters<typeof POST>[0]
}

/** Blob minimo que Next ve como File con type image/*. */
function imageFile(name = 'logo.png', type = 'image/png', bytes = 8) {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('POST /api/config/tenant/branding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { tenantId: 'tenant-1' } })
    vi.mocked(uploadImage).mockResolvedValue(
      'https://cdn.test/branding/logo.png',
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('autenticacion', () => {
    it('401 sin sesion, sin tocar la base', async () => {
      authMock.mockResolvedValue(null)

      const res = await POST(brandingReq(imageFile()))

      expect(res.status).toBe(401)
      expect(withTenantContext).not.toHaveBeenCalled()
    })

    it('401 si la sesion no tiene tenantId', async () => {
      authMock.mockResolvedValue({ user: { tenantId: null } })

      const res = await POST(brandingReq(imageFile()))

      expect(res.status).toBe(401)
      expect(withTenantContext).not.toHaveBeenCalled()
    })
  })

  describe('validacion de la entrada', () => {
    it('400 si no viene archivo', async () => {
      const res = await POST(brandingReq(undefined))

      expect(res.status).toBe(400)
      expect(withTenantContext).not.toHaveBeenCalled()
    })

    it('400 si el archivo esta vacio', async () => {
      const res = await POST(brandingReq(imageFile('logo.png', 'image/png', 0)))

      expect(res.status).toBe(400)
      expect(withTenantContext).not.toHaveBeenCalled()
    })

    it('400 si no es una imagen, con field logo', async () => {
      const res = await POST(brandingReq(imageFile('x.pdf', 'application/pdf')))

      expect(res.status).toBe(400)
      const body = (await res.json()) as { field: string }
      expect(body.field).toBe('logo')
      expect(uploadImage).not.toHaveBeenCalled()
    })
  })

  describe('escritura', () => {
    it('persiste el logoUrl que devuelve storage', async () => {
      const { tx, updates } = spyTx()
      vi.mocked(withTenantContext).mockImplementation(
        async (_t: string, cb: (t: unknown) => unknown) => cb(tx) as never,
      )

      const res = await POST(brandingReq(imageFile()))

      expect(res.status).toBe(200)
      expect(updates).toHaveLength(1)
      expect(updates[0].logoUrl).toBe('https://cdn.test/branding/logo.png')
      // Toda escritura de `tenants` tiene que mover `updatedAt`; no hacerlo deja
      // la fila con una fecha de modificacion que no corresponde.
      expect(updates[0].updatedAt).toBeInstanceOf(Date)
    })

    it('el nombre del objeto incluye el tenantId: dos tenants no colisionan', async () => {
      const { tx } = spyTx()
      vi.mocked(withTenantContext).mockImplementation(
        async (_t: string, cb: (t: unknown) => unknown) => cb(tx) as never,
      )

      await POST(brandingReq(imageFile()))

      const fileName = vi.mocked(uploadImage).mock.calls[0][1]
      expect(fileName).toContain('branding/tenant-1/')
    })

    it('404 si el update no afecta filas', async () => {
      const { tx } = spyTx({ returning: [] })
      vi.mocked(withTenantContext).mockImplementation(
        async (_t: string, cb: (t: unknown) => unknown) => cb(tx) as never,
      )

      const res = await POST(brandingReq(imageFile()))

      expect(res.status).toBe(404)
    })

    /**
     * Progresividad (R5): un servicio externo caido no puede voltear en 500 una
     * operacion cuyo resultado desirable -guardar el tenant, no romper la
     * tienda- sigue siendo posible.
     */
    it('si R2 falla, responde 200 con logoUrl null y NO rompe', async () => {
      const { tx, updates } = spyTx()
      vi.mocked(withTenantContext).mockImplementation(
        async (_t: string, cb: (t: unknown) => unknown) => cb(tx) as never,
      )
      vi.mocked(uploadImage).mockRejectedValue(new Error('R2 no configurado'))

      const res = await POST(brandingReq(imageFile()))

      expect(res.status).toBe(200)
      expect(updates[0].logoUrl).toBeNull()
      expect(loggerWarn).toHaveBeenCalled()
    })

    it('si R2 falla, la tienda sigue viva: el branding es decorativo', async () => {
      const { tx } = spyTx()
      vi.mocked(withTenantContext).mockImplementation(
        async (_t: string, cb: (t: unknown) => unknown) => cb(tx) as never,
      )
      vi.mocked(uploadImage).mockRejectedValue(new Error('R2 no configurado'))

      const res = await POST(brandingReq(imageFile()))

      // El endpoint responde igual, y sobre todo **no** 500.
      expect(res.status).not.toBe(500)
    })
  })

  describe('el update se hace dentro del contexto de tenant', () => {
    it('usa withTenantContext con el tenantId de la sesion', async () => {
      const { tx } = spyTx()
      vi.mocked(withTenantContext).mockImplementation(
        async (_t: string, cb: (t: unknown) => unknown) => cb(tx) as never,
      )

      await POST(brandingReq(imageFile()))

      expect(withTenantContext).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      )
    })
  })
})

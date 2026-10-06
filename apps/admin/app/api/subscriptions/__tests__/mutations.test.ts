import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'
import { makeTxMock, session } from '@repo/test-utils'

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

// Solo se pisa lo que toca la red. `derivePermissions` y el resto siguen siendo
// los reales para que el test cubra la politica real.
vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return {
    ...actual,
    updatePreapproval: vi.fn(),
    getPreapproval: vi.fn(),
  }
})

import { auth } from '@/lib/auth'
import { updatePreapproval, getPreapproval } from '@repo/commerce'
import { POST as cancel } from '../cancel/route'
import { POST as pause } from '../pause/route'
import { POST as resume } from '../resume/route'

const TOKEN = 'APP_USR-platform-token'

function sub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    status: 'active',
    mpPreapprovalId: 'preapproval-abc',
    ...overrides,
  }
}

function mockSubContext(row: unknown) {
  vi.mocked(withTenantContext).mockImplementation(async (_t, cb) =>
    cb(makeTxMock({ select: [{ data: row === null ? [] : [row], terminal: 'limit' }] })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MP_PLATFORM_ACCESS_TOKEN = TOKEN
  vi.mocked(updatePreapproval).mockResolvedValue({ id: 'preapproval-abc' })
  vi.mocked(getPreapproval).mockResolvedValue({ status: 'authorized' })
})

describe('mutaciones de estado — auth', () => {
  for (const [nombre, handler] of [
    ['cancel', cancel],
    ['pause', pause],
    ['resume', resume],
  ] as const) {
    it(`${nombre}: 401 sin sesion y no toca la DB ni MP`, async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const res = await handler()

      expect(res.status).toBe(401)
      expect(withTenantContext).not.toHaveBeenCalled()
      expect(updatePreapproval).not.toHaveBeenCalled()
    })

    it(`${nombre}: 400 si la sesion no trae tenantId`, async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: 'a@b.com' },
        expires: new Date(Date.now() + 60_000).toISOString(),
      } as never)

      const res = await handler()

      expect(res.status).toBe(400)
      expect(updatePreapproval).not.toHaveBeenCalled()
    })
  }
})

describe('cancel', () => {
  it('202 y pide `cancelled` a MP cuando esta activa', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub())
    vi.mocked(getPreapproval).mockResolvedValue({ status: 'cancelled' })

    const res = await cancel()
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.status).toBe('cancelled')
    expect(updatePreapproval).toHaveBeenCalledWith(
      'preapproval-abc',
      { status: 'cancelled' },
      TOKEN,
    )
  })

  it('202 desde `paused`: puede cancelar sin reanudar antes', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'paused' }))
    vi.mocked(getPreapproval).mockResolvedValue({ status: 'cancelled' })

    const res = await cancel()
    const body = await res.json()

    // Decision de producto (Luis, 2026-10-04): `paused` es "suspender el
    // cobro", no "bloquear acciones". Antes esto devolvia 409 y obligaba a
    // `resume` -> `cancel`, que era burocracia sin beneficio.
    expect(res.status).toBe(202)
    expect(body.status).toBe('cancelled')
    expect(updatePreapproval).toHaveBeenCalledWith(
      'preapproval-abc',
      { status: 'cancelled' },
      TOKEN,
    )
  })

  it('409 desde `past_due`: con factura impaga MP no procesa la baja', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'past_due' }))

    const res = await cancel()

    expect(res.status).toBe(409)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('409 desde `cancelled`: la cancelacion es irreversible', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'cancelled' }))

    const res = await cancel()

    expect(res.status).toBe(409)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('404 si el tenant no tiene suscripcion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(null)

    const res = await cancel()

    expect(res.status).toBe(404)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('409 si la suscripcion no tiene preapproval en MP', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ mpPreapprovalId: null }))

    const res = await cancel()

    expect(res.status).toBe(409)
    expect((await res.json()).field).toBe('preapproval')
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('500 sin token de plataforma, sin tocar MP', async () => {
    delete process.env.MP_PLATFORM_ACCESS_TOKEN
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub())

    const res = await cancel()

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('MercadoPago no configurado')
    expect(updatePreapproval).not.toHaveBeenCalled()
  })
})

describe('pause', () => {
  it('202 y pide `paused` a MP cuando esta activa', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub())
    vi.mocked(getPreapproval).mockResolvedValue({ status: 'paused' })

    const res = await pause()
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.status).toBe('paused')
    expect(updatePreapproval).toHaveBeenCalledWith(
      'preapproval-abc',
      { status: 'paused' },
      TOKEN,
    )
  })

  it('409 si ya esta pausada (doble click)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'paused' }))

    const res = await pause()

    expect(res.status).toBe(409)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })
})

describe('resume', () => {
  it('202 y pide `authorized` a MP cuando esta pausada', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'paused' }))
    vi.mocked(getPreapproval).mockResolvedValue({ status: 'authorized' })

    const res = await resume()
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.status).toBe('authorized')
    expect(updatePreapproval).toHaveBeenCalledWith(
      'preapproval-abc',
      { status: 'authorized' },
      TOKEN,
    )
  })

  it('409 si NO esta pausada', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'active' }))

    const res = await resume()

    expect(res.status).toBe(409)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('NO revive desde `cancelled`: en MP es terminal', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'cancelled' }))

    const res = await resume()

    expect(res.status).toBe(409)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })

  it('NO revive desde `expired`: es otro flujo', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub({ status: 'expired' }))

    const res = await resume()

    expect(res.status).toBe(409)
    expect(updatePreapproval).not.toHaveBeenCalled()
  })
})

describe('mutaciones — verificacion post-escritura (leccion del spike T0)', () => {
  it('502 si MP acepta el PUT pero el estado no quedo aplicado', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub())
    // El PUT "va bien" pero el GET delata que nada cambio.
    vi.mocked(updatePreapproval).mockResolvedValue({ id: 'preapproval-abc' })
    vi.mocked(getPreapproval).mockResolvedValue({ status: 'authorized' })

    const res = await pause()

    // Sin esto seria un 202 falso: el endpointeria reportado exito y el tenant
    // seguiria siendo cobrado.
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/no se actualizo/)
  })

  it('202 si el GET de verificacion falla: el PUT ya salio bien', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub())
    vi.mocked(getPreapproval).mockRejectedValue(new Error('timeout'))

    const res = await pause()

    // Tirar por la borda una operacion valida seria peor que no verificarla.
    expect(res.status).toBe(202)
  })
})

describe('mutaciones — errores de MP', () => {
  it('502 cuando MP rechaza la transicion', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub())
    const err = new Error('Invalid transition from active to paused')
    err.name = 'MercadoPagoApiError'
    vi.mocked(updatePreapproval).mockRejectedValue(err)

    const res = await pause()

    expect(res.status).toBe(502)
  })

  it('503 cuando falla la red (timeout)', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    mockSubContext(sub())
    const err = new Error('timeout fetching')
    err.name = 'MercadoPagoApiError'
    vi.mocked(updatePreapproval).mockRejectedValue(err)

    const res = await pause()

    // No hubo respuesta de MP: 503 es mas honesto que 502.
    expect(res.status).toBe(503)
  })
})

describe('mutaciones — aislamiento multi-tenant', () => {
  // `resume` parte de `paused`; los otros dos, de `active`. Sin esto el 409 de
  // estado haria pasar el test por el motivo equivocado.
  for (const [nombre, handler, estado] of [
    ['cancel', cancel, 'active'],
    ['pause', pause, 'active'],
    ['resume', resume, 'paused'],
  ] as const) {
    it(`${nombre}: el preapproval sale del tenant de la sesion`, async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-99'))
      mockSubContext(sub({ status: estado }))

      await handler()

      expect(withTenantContext).toHaveBeenCalledWith(
        'tenant-99',
        expect.any(Function),
      )
      expect(withTenantContext).toHaveBeenCalledTimes(1)
      // La fila leida pertenece al tenant de la sesion, y el PUT usa ese
      // mpPreapprovalId. No hay forma de operar sobre otro tenant.
      expect(updatePreapproval).toHaveBeenCalledWith(
        'preapproval-abc',
        expect.any(Object),
        TOKEN,
      )
    })
  }
})

describe('mutaciones - fallo de infraestructura (T6)', () => {
  // Los tres `catch` de cancel/pause/resume estaban sin cubrir: las tres rutas
  // rendian 71.42% de lineas y el unico hueco era el `serverError`. Un 500 en
  // estas tres rutas no lo ejercitaba nadie.
  for (const [nombre, handler, mensaje] of [
    ['cancel', cancel, 'Error al cancelar la suscripcion'],
    ['pause', pause, 'Error al pausar la suscripcion'],
    ['resume', resume, 'Error al reanudar la suscripcion'],
  ] as const) {
    it(`${nombre}: si la DB cae, 500 sin tocar MP`, async () => {
      vi.mocked(auth).mockResolvedValue(session('tenant-1'))
      // Falla el contexto de tenant, que es la causa real de un 500 aca.
      vi.mocked(withTenantContext).mockRejectedValue(
        new Error('db no disponible'),
      )

      const res = await handler()

      expect(res.status).toBe(500)
      // El mensaje es el de la ruta, no el del error interno: no se filtra el
      // detalle de la infraestructura.
      expect(await res.json()).toEqual({ error: mensaje })
      // Y lo importante: nada se escribio en MP. Un 500 con un PUT a MP ya
      // hecho dejaria al tenant en un estado que la DB no registra.
      expect(updatePreapproval).not.toHaveBeenCalled()
    })
  }
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { mockReq, session } from '@repo/test-utils'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))
vi.mock('@repo/db', { db: undefined })

import { auth } from '@/lib/auth'
import { GET, PUT } from '../route'

beforeEach(() => {
  vi.clearAllMocks()
})

function setupDb(data: any[]) {
  ;(db as any).select = vi.fn().mockReturnThis()
  ;(db as any).from = vi.fn().mockReturnThis()
  ;(db as any).where = vi.fn().mockReturnThis()
  ;(db as any).limit = vi.fn().mockResolvedValue(data)
}

describe('GET /api/config/settings', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 404 when tenant not found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Tenant no encontrado')
  })

  it('should return settings', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([{ settings: { primaryColor: '#ff0000' } }])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.settings.primaryColor).toBe('#ff0000')
  })

  it('should return empty settings object when tenant has no settings', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([{ settings: null }])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.settings).toEqual({})
  })
})

describe('PUT /api/config/settings', () => {
  it('should return 401 when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await PUT(mockReq('PUT', { primaryColor: '#ff0000' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('No autorizado')
  })

  it('should return 404 when tenant not found', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([])

    const response = await PUT(mockReq('PUT', { primaryColor: '#ff0000' }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Tenant no encontrado')
  })

  it('should return 400 when validation fails', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([{ id: 'tenant-1', settings: {} }])

    const response = await PUT(mockReq('PUT', { primaryColor: 'not-a-color' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validación fallida')
  })

  it('should update settings successfully', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([{ id: 'tenant-1', settings: {} }])
    ;(db as any).update = vi.fn().mockReturnThis()
    ;(db as any).set = vi.fn().mockReturnThis()
    ;(db as any).where = vi.fn().mockReturnThis()
    ;(db as any).returning = vi
      .fn()
      .mockResolvedValue([{ settings: { primaryColor: '#ff0000' } }])

    const response = await PUT(mockReq('PUT', { primaryColor: '#ff0000' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.settings.primaryColor).toBe('#ff0000')
  })
})

/**
 * T11 fix / H-F3-v2-1: `tenants."logoUrl"` es la fuente de verdad y este
 * endpoint dejo de escribirla (opcion A). Estas pruebas fijan las dos mitades
 * del contrato: la sigue leyendo para mostrarla, y la sigue rechazando como
 * escritura.
 */
describe('T11 fix — logoUrl: lectura si, escritura no', () => {
  it('GET expone el logo de la columna, no el del jsonb', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    // El jsonb todavia tiene el valor viejo (deprecado pero intacto) y la
    // columna tiene el nuevo. Si el endpoint leyera el jsonb, devolveria el
    // viejo y la prueba fallaria.
    setupDb([
      {
        logoUrl: 'https://cdn.example.com/logo-nuevo.png',
        settings: { logoUrl: 'https://cdn.example.com/logo-viejo.png' },
      },
    ])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tenant.logoUrl).toBe('https://cdn.example.com/logo-nuevo.png')
    // Y el jsonb sigue sin tocarse: se conserva como respaldo.
    expect(body.settings.logoUrl).toBe('https://cdn.example.com/logo-viejo.png')
  })

  it('GET devuelve logoUrl null cuando el tenant no tiene logo', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([{ logoUrl: null, settings: {} }])

    const response = await GET()
    const body = await response.json()

    expect(body.tenant.logoUrl).toBeNull()
  })

  it('PUT ignora logoUrl: no lo escribe en el jsonb', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([{ id: 'tenant-1', settings: {} }])

    const setSpy = vi.fn().mockReturnThis()
    ;(db as any).update = vi.fn().mockReturnThis()
    ;(db as any).set = setSpy
    ;(db as any).where = vi.fn().mockReturnThis()
    ;(db as any).returning = vi.fn().mockResolvedValue([{ settings: {} }])

    // El cliente puede seguir mandandolo (o no): el endpoint lo descarta.
    await PUT(mockReq('PUT', { logoUrl: 'https://evil.example.com/x.png' }))

    const written = setSpy.mock.calls[0][0] as Record<string, unknown>
    expect(written.settings).toEqual({})
  })

  it('PUT con logoUrl no rompe: responde 200 igual', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([{ id: 'tenant-1', settings: {} }])
    ;(db as any).update = vi.fn().mockReturnThis()
    ;(db as any).set = vi.fn().mockReturnThis()
    ;(db as any).where = vi.fn().mockReturnThis()
    ;(db as any).returning = vi
      .fn()
      .mockResolvedValue([{ settings: { primaryColor: '#ff0000' } }])

    const response = await PUT(
      mockReq('PUT', {
        logoUrl: 'https://cdn.example.com/logo.png',
        primaryColor: '#ff0000',
      }),
    )

    // Zod hace strip de claves desconocidas: no es un 400. Un 400 habria
    // roto el formulario de admin entero.
    expect(response.status).toBe(200)
  })

  it('PUT conserva el logo viejo del jsonb al mergear', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))
    setupDb([
      {
        id: 'tenant-1',
        settings: { logoUrl: 'https://cdn.example.com/logo-viejo.png' },
      },
    ])

    const setSpy = vi.fn().mockReturnThis()
    ;(db as any).update = vi.fn().mockReturnThis()
    ;(db as any).set = setSpy
    ;(db as any).where = vi.fn().mockReturnThis()
    ;(db as any).returning = vi.fn().mockResolvedValue([{ settings: {} }])

    await PUT(mockReq('PUT', { primaryColor: '#ff0000' }))

    const written = setSpy.mock.calls[0][0] as {
      settings: Record<string, unknown>
    }
    // Deliberado: el campo queda deprecado pero intacto. Lo limpia una
    // migracion aparte cuando ningun proceso lo lea.
    expect(written.settings.logoUrl).toBe('https://cdn.example.com/logo-viejo.png')
    expect(written.settings.primaryColor).toBe('#ff0000')
  })
})

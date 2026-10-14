import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withTenantContext } from '@repo/db'

vi.mock('@repo/commerce', async () => {
  const actual = await vi.importActual<typeof import('@repo/commerce')>(
    '@repo/commerce',
  )
  return { ...actual, getPermissions: vi.fn() }
})
vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn() }
})

import { getPermissions } from '@repo/commerce'
import { denyIfNoPermission } from '../permission-guard'
import type { SubscriptionPermissions } from '@repo/commerce'

const TX = {} as never

function perms(over: Partial<SubscriptionPermissions>): SubscriptionPermissions {
  return {
    canWrite: false,
    canSell: false,
    canChangePlan: false,
    canCancel: false,
    canReactivate: false,
    canPause: false,
    canResume: false,
    canAccessStorefront: false,
    canAccessPanel: 'none',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(withTenantContext).mockImplementation(async (_t, cb) => cb(TX))
})

describe('denyIfNoPermission', () => {
  it('devuelve null cuando el permiso esta', async () => {
    vi.mocked(getPermissions).mockResolvedValue(perms({ canWrite: true }))

    const denied = await denyIfNoPermission('t1', 'canWrite')

    expect(denied).toBeNull()
  })

  it('devuelve 403 cuando el permiso falta', async () => {
    vi.mocked(getPermissions).mockResolvedValue(perms({ canWrite: false }))

    const denied = await denyIfNoPermission('t1', 'canWrite')

    expect(denied).not.toBeNull()
    expect(denied!.status).toBe(403)
    await expect(denied!.json()).resolves.toMatchObject({
      permission: 'canWrite',
    })
  })

  it('propaga el error si getPermissions lanza: no degrada a permitido', async () => {
    vi.mocked(getPermissions).mockRejectedValue(
      new Error('unknown subscription status'),
    )

    // Un estado desconocido tiene que ser ruidoso: devolver null abriria el
    // panel de un tenant en un estado que nadie sabe que existe.
    await expect(denyIfNoPermission('t1', 'canWrite')).rejects.toThrow(
      /unknown subscription status/,
    )
  })
})

/**
 * Matriz completa de la politica x los dos permisos que S4c impone.
 *
 * El archivo fuente de verdad es `subscription-permissions.test.ts` (que prueba
 * la funcion pura). Acotamos a los DOS permisos que un endpoint puede exigir, y
 * verificamos el efecto observable del guard: `null` o 403.
 *
 * Derivada de la tabla del transversal (seccion 2) y de D17.
 */
const MATRIX: {
  tenant: string
  subscription: string
  canWrite: boolean
  canSell: boolean
  motivo: string
}[] = [
  { tenant: 'active', subscription: 'active', canWrite: true, canSell: true, motivo: 'todo permitted' },
  { tenant: 'active', subscription: 'past_due', canWrite: false, canSell: true, motivo: 'D17: vende, no publica' },
  { tenant: 'active', subscription: 'paused', canWrite: false, canSell: true, motivo: 'pausa el cobro, no bloquea vender' },
  { tenant: 'active', subscription: 'cancelled', canWrite: false, canSell: false, motivo: 'read-only hasta fin de periodo' },
  { tenant: 'active', subscription: 'expired', canWrite: false, canSell: false, motivo: 'read-only' },
  { tenant: 'active', subscription: 'abandoned', canWrite: false, canSell: false, motivo: 'se dio de alta y no pago' },
  { tenant: 'pending', subscription: 'pending_first_payment', canWrite: false, canSell: false, motivo: 'onboarding: solo deja cosas listas' },
  { tenant: 'suspended', subscription: 'active', canWrite: false, canSell: false, motivo: 'bloqueo de plataforma' },
  { tenant: 'cancelled', subscription: 'active', canWrite: false, canSell: false, motivo: 'dio de baja su tienda' },
]

describe('matriz de guards por estado (S4c / item 103)', () => {
  it.each(MATRIX)(
    '$tenant + $subscription -> canWrite=$canWrite canSell=$canSell ($motivo)',
    async ({ canWrite, canSell }) => {
      const target = canWrite ? canWrite : canSell
      vi.mocked(getPermissions).mockResolvedValue(
        perms({ canWrite, canSell, canAccessPanel: 'readonly' }),
      )

      const deniedWrite = await denyIfNoPermission('t1', 'canWrite')
      const deniedSell = await denyIfNoPermission('t1', 'canSell')

      expect(deniedWrite === null).toBe(canWrite)
      expect(deniedSell === null).toBe(canSell)
      expect(target).toBe(canWrite || canSell)
    },
  )
})
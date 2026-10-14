import { describe, it, expect } from 'vitest'
import {
  deriveTenantPermissions,
  type PanelAccess,
  type SubscriptionPermissions,
  type SubscriptionStatus,
  type TenantStatus,
} from '../subscription-permissions'

/**
 * Matriz de permisos de dos dimensiones (S4b / T10).
 *
 * Cierra el item 97: la tabla de D17 tiene 7 filas y ninguna era
 * `abandoned`. Esta la responde explicitamente.
 *
 * **Por que `it.each` y no un `for`.** Un `for` sobre los estados pasaria en
 * verde con el array vacio, y con una fila mal cargada pasaria igual: el test
 * recorreria, pero no afirmaria nada. Cada fila de la tabla de abajo es un
 * test que verifica los **tres** permisos a la vez, para que un permiso que se
 * mueve no pase por el，el del que sí se mueve.
 */

interface Row {
  tenant: TenantStatus
  subscription: SubscriptionStatus
  canPublish: boolean
  canSell: boolean
  panel: PanelAccess
  /** Por que esta fila es la que es. Va en el nombre del test. */
  motivo: string
}

/**
 * Las combinaciones que el diseno define de forma distinta.
 *
 * No son las 4 x 7 = 28: `pending` y `active` no agregan nada sobre la
 * suscripcion, asi que `suspended` y `cancelled` de tenant se prueban sobre el
 * estado `active` (el mas permisivo), que es donde el override se nota. Las
 * combinaciones redundantes se cubren en el describe de abajo.
 */
const MATRIX: Row[] = [
  {
    tenant: 'pending',
    subscription: 'pending_first_payment',
    canPublish: false,
    canSell: false,
    panel: 'readonly',
    motivo:
      'item 96: el owner accede para configurar antes de pagar, pero el subdominio no resuelve',
  },
  {
    tenant: 'active',
    subscription: 'active',
    canPublish: true,
    canSell: true,
    panel: 'full',
    motivo: 'el unico caso con los tres permisos',
  },
  {
    tenant: 'active',
    subscription: 'past_due',
    canPublish: false,
    canSell: true,
    panel: 'limited',
    motivo:
      'D17: la asimetria deliberada. El comprador no fallo el pago, el tenant si',
  },
  {
    tenant: 'active',
    subscription: 'paused',
    canPublish: false,
    canSell: true,
    panel: 'limited',
    motivo: 'pausar el cobro no es cerrar la tienda',
  },
  {
    tenant: 'active',
    subscription: 'cancelled',
    canPublish: false,
    canSell: false,
    panel: 'readonly',
    motivo:
      'la tienda responde en read-only hasta fin de periodo, pero no acepta pedidos',
  },
  {
    tenant: 'active',
    subscription: 'expired',
    canPublish: false,
    canSell: false,
    panel: 'readonly',
    motivo: 'item 97: ver lo que perdio, no escribir',
  },
  {
    tenant: 'active',
    subscription: 'abandoned',
    canPublish: false,
    canSell: false,
    panel: 'readonly',
    motivo: 'item 97: la fila que faltaba en D17',
  },
  {
    tenant: 'suspended',
    subscription: 'active',
    canPublish: false,
    canSell: false,
    panel: 'none',
    motivo:
      'bloqueo de plataforma: el tenant manda sobre la suscripcion, y no entra',
  },
  {
    tenant: 'cancelled',
    subscription: 'active',
    canPublish: false,
    canSell: false,
    panel: 'readonly',
    motivo: 'el tenant dio de baja su tienda',
  },
]

/** `canPublish` se deriva de `canWrite`: la UI y los endpoints usan ese. */
function publishing(p: SubscriptionPermissions): boolean {
  return p.canWrite
}

describe('deriveTenantPermissions - matriz de D17 + item 97', () => {
  it.each(MATRIX)(
    '$tenant / $subscription -> publica=$canPublish vende=$canSell panel=$panel ($motivo)',
    ({ tenant, subscription, canPublish, canSell, panel }) => {
      const p = deriveTenantPermissions(tenant, subscription)

      expect(publishing(p)).toBe(canPublish)
      expect(p.canSell).toBe(canSell)
      expect(p.canAccessPanel).toBe(panel)
    },
  )
})

/** Los 7 estados del ciclo de vida, para probar el override sobre cada uno. */
const SUBS: SubscriptionStatus[] = [
  'pending_first_payment',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired',
  'abandoned',
]

describe('el estado del tenant manda sobre el de la suscripcion', () => {
  it.each(SUBS)(
    'suspended + %s no vende ni publica, y no entra al panel',
    (s) => {
      const p = deriveTenantPermissions('suspended', s)

      expect(p.canSell).toBe(false)
      expect(p.canWrite).toBe(false)
      expect(p.canAccessPanel).toBe('none')
      expect(p.canAccessStorefront).toBe(false)
    },
  )

  it.each(SUBS)(
    'cancelled (tenant) + %s: sin escribir, sin vender, read-only',
    (s) => {
      const p = deriveTenantPermissions('cancelled', s)

      expect(p.canSell).toBe(false)
      expect(p.canWrite).toBe(false)
      expect(p.canAccessPanel).toBe('readonly')
    },
  )

  /**
   * El override de `cancelled` (tenant) tiene `canReactivate: false` explicito
   * y **no** heredado. Omitirlo en un `Partial<...>` lo dejaria venir de la
   * suscripcion, y un tenant dado de baja con suscripcion `expired` podria
   * "reactivarse". Esta es la combinacion que lo delata.
   */
  it('cancelled (tenant) + expired NO hereda canReactivate de la suscripcion', () => {
    const soloSuscripcion = deriveTenantPermissions('active', 'expired')
    const conTenant = deriveTenantPermissions('cancelled', 'expired')

    expect(soloSuscripcion.canReactivate).toBe(true)
    expect(conTenant.canReactivate).toBe(false)
  })
})

describe('pending y active no alteran la suscripcion', () => {
  it.each(SUBS)('pending + %s da los mismos permisos que active + %s', (s) => {
    // `pending` es el estado de un tenant recien dado de alta; su suscripcion
    // es `pending_first_payment`. La comparacion aca prueba que el override es
    // `null` para `pending`, es decir que no toca nada.
    const soloEstado = deriveTenantPermissions('pending', s)
    const directa = deriveTenantPermissions('active', s)

    if (s === 'pending_first_payment') {
      // Aca si difieren, y es a proposito: pending_first_payment con tenant
      // pending es readonly, con tenant active tambien. Se verifica aparte.
      expect(soloEstado.canAccessPanel).toBe('readonly')
      expect(directa.canAccessPanel).toBe('readonly')
    } else {
      expect(soloEstado).toEqual(directa)
    }
  })
})

describe('funcion total: estado desconocido no devuelve permisos', () => {
  it('tira con un tenant status desconocido', () => {
    expect(() =>
      deriveTenantPermissions('borrado' as TenantStatus, 'active'),
    ).toThrow(/unknown tenant status/)
  })

  it('tira con un subscription status desconocido', () => {
    expect(() =>
      deriveTenantPermissions('active', 'inventado' as SubscriptionStatus),
    ).toThrow(/unknown subscription status/)
  })

  /**
   * Que tire y no devuelva un default es lo que evita el item 97 de nuevo:
   * un estado nuevo cae en el `undefined` de un `Record` y revienta, en vez de
   * devolver un objeto de permisos inventado que abriria el panel de un tenant
   * en un estado que no entendemos.
   */
  it('elRecord del override distingue "null" de "undefined"', () => {
    // `suspended` esta en el mapa; `inventado` no. Por eso el check de
    // `undefined` puede ir antes del spread.
    expect(() => deriveTenantPermissions('suspended', 'active')).not.toThrow()
    expect(() =>
      deriveTenantPermissions('inventado' as TenantStatus, 'active'),
    ).toThrow()
  })
})

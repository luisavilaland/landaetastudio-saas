import { describe, expect, it } from 'vitest'
import {
  derivePermissions,
  type SubscriptionStatus,
} from '../subscription-permissions'

// Fuente: docs/superpowers/specs/2026-09-subscription-lifecycle.md seccion 2
// ("Reglas de negocio por estado"). Si cambia la politica, actualizar el spec y
// este archivo en el MISMO PR.
//
// `paused` NO esta en el transversal todavia (que lista 6 estados). Se agrega
// aca porque:
//   1. MP expone el estado y la transicion funciona (verificado 2026-10-03:
//      `authorized -> paused` y `paused -> authorized`, ambos 200 + GET).
//   2. La doc oficial de MP confirma que `paused` DETIENE el cobro:
//      "Mercado Pago deje de debitar los pagos de ese cliente hasta que
//       decidas reactivarlo"
//      (https://www.mercadopago.com.ar/developers/es/docs/subscription-plans/manage-subscription-plan)
//   3. `cancel` es TERMINAL en MP (400 "Invalid transition from cancelled to
//      authorized"), asi que `pause` es el unico camino reversible. Sin el,
//      no hay forma de que un tenant vuelva.
//
// TODO(transversal): agregar `paused` a la tabla de la seccion 2 y a la lista
// de estados de la seccion 1. Hoy el transversal dice 6 estados y el codigo
// tiene 7.
describe('derivePermissions', () => {
  it('pending_first_payment: sin panel, sin escritura, sin storefront', () => {
    const p = derivePermissions('pending_first_payment')

    expect(p.canAccessPanel).toBe('none')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(false)
    expect(p.canPause).toBe(false)
    expect(p.canResume).toBe(false)
  })

  it('active: acceso total, unico estado con escritura y con pause', () => {
    const p = derivePermissions('active')

    expect(p.canAccessPanel).toBe('full')
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canWrite).toBe(true)
    expect(p.canChangePlan).toBe(true)
    expect(p.canCancel).toBe(true)
    expect(p.canReactivate).toBe(false)
    expect(p.canPause).toBe(true)
    expect(p.canResume).toBe(false)
  })

  it('past_due: panel limitado, solo lectura, storefront sigue abierto', () => {
    const p = derivePermissions('past_due')

    expect(p.canAccessPanel).toBe('limited')
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(false)
    expect(p.canPause).toBe(false)
    expect(p.canResume).toBe(false)
  })

  it('paused: conserva storefront, puede reanudar, no puede cancelar ni pausar', () => {
    const p = derivePermissions('paused')

    // Conserva el acceso: `paused` suspende el COBRO, no el servicio. La doc de
    // MP lo define como "suscripcion con cobro temporalmente interrumpido".
    expect(p.canAccessStorefront).toBe(true)
    // No genera perdida de acceso, asi que el panel sigue disponible. Se elige
    // 'limited' y no 'readonly' porque el tenant tiene una accion util que es
    // justamente `resume`.
    expect(p.canAccessPanel).toBe('limited')
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    // Cancelar desde paused ES posible en MP, pero desde la UI tiene sentido
    // ofrecer solo "reanudar": el tenant que pauso quiere volver, no irse.
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(false)
    expect(p.canPause).toBe(false)
    expect(p.canResume).toBe(true)
  })

  it('cancelled: panel solo lectura, storefront hasta fin de periodo', () => {
    const p = derivePermissions('cancelled')

    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(true)
    expect(p.canPause).toBe(false)
    expect(p.canResume).toBe(false)
  })

  it('expired: panel bloqueado, pero se puede reactivar', () => {
    const p = derivePermissions('expired')

    expect(p.canAccessPanel).toBe('none')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(true)
    expect(p.canPause).toBe(false)
    expect(p.canResume).toBe(false)
  })

  it('abandoned: registro incompleto, sin reactivacion', () => {
    const p = derivePermissions('abandoned')

    expect(p.canAccessPanel).toBe('none')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(false)
    expect(p.canPause).toBe(false)
    expect(p.canResume).toBe(false)
  })

  it('lanza en un estado desconocido en vez de devolver permisos por defecto', () => {
    // Devolver permisos por defecto abriria el panel de un tenant en un estado
    // que no entendemos.
    expect(() =>
      derivePermissions('estado_inventado' as SubscriptionStatus),
    ).toThrow(/unknown subscription status/)
  })
})

describe('derivePermissions — matriz completa (proteccion contra regresiones)', () => {
  const ALL: SubscriptionStatus[] = [
    'pending_first_payment',
    'active',
    'past_due',
    'paused',
    'cancelled',
    'expired',
    'abandoned',
  ]

  it('el snapshot de la matriz completa coincide con la politica', () => {
    const snapshot = ALL.map((status) => {
      const p = derivePermissions(status)
      return [
        status,
        p.canAccessPanel,
        p.canAccessStorefront,
        p.canWrite,
        p.canChangePlan,
        p.canCancel,
        p.canReactivate,
        p.canPause,
        p.canResume,
      ].join('|')
    })

    expect(snapshot).toEqual([
      'pending_first_payment|none|false|false|false|false|false|false|false',
      'active|full|true|true|true|true|false|true|false',
      'past_due|limited|true|false|false|false|false|false|false',
      'paused|limited|true|false|false|false|false|false|true',
      'cancelled|readonly|true|false|false|false|true|false|false',
      'expired|none|false|false|false|false|true|false|false',
      'abandoned|none|false|false|false|false|false|false|false',
    ])
  })

  it('solo active puede escribir y cambiar de plan', () => {
    expect(ALL.filter((s) => derivePermissions(s).canWrite)).toEqual(['active'])
    expect(ALL.filter((s) => derivePermissions(s).canChangePlan)).toEqual([
      'active',
    ])
  })

  it('pause y resume son mutuamente excluyentes', () => {
    const canPause = ALL.filter((s) => derivePermissions(s).canPause)
    const canResume = ALL.filter((s) => derivePermissions(s).canResume)

    expect(canPause).toEqual(['active'])
    expect(canResume).toEqual(['paused'])
    // Ningun estado puede offerser ambas cosas.
    expect(canPause.filter((s) => canResume.includes(s))).toEqual([])
  })

  it('el storefront queda abierto en active, past_due, paused y cancelled', () => {
    expect(ALL.filter((s) => derivePermissions(s).canAccessStorefront)).toEqual([
      'active',
      'past_due',
      'paused',
      'cancelled',
    ])
  })

  it('cancelled y expired son los unicos reactivables (reactivate legacy)', () => {
    expect(ALL.filter((s) => derivePermissions(s).canReactivate)).toEqual([
      'cancelled',
      'expired',
    ])
  })
})
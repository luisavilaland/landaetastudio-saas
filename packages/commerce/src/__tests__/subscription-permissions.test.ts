import { describe, expect, it } from 'vitest'
import { derivePermissions } from '../subscription-permissions'

// Fuente: docs/superpowers/specs/2026-09-subscription-lifecycle.md §2
// ("Tabla resumen: Estado x Permisos"). Si cambia la politica,
// actualizar el spec y este archivo en el MISMO PR.
//
// Nota de fidelidad: canWrite, canChangePlan, canAccessStorefront y
// canAccessPanel son transcripcion directa de la tabla. canCancel y
// canReactivate NO tienen fila propia en la tabla (la tabla no lista
// "cancelar" ni "reactivar"); se derivan del detalle por estado del §2.
// Ver los comentarios de cada caso.
describe('derivePermissions', () => {
  it('pending_first_payment: sin panel, sin escritura, sin storefront', () => {
    const p = derivePermissions('pending_first_payment')

    // Tabla: todas las acciones ❌, tienda pública ❌, panel ❌ -> 'none'.
    expect(p.canAccessPanel).toBe('none')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    // Derivado: nunca se dio de alta, no hay nada que cancelar ni reactivar.
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(false)
  })

  it('active: acceso total, unico estado con escritura', () => {
    const p = derivePermissions('active')

    expect(p.canAccessPanel).toBe('full')
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canWrite).toBe(true)
    expect(p.canChangePlan).toBe(true)
    // Derivado: la suscripcion viva es la unica que se puede cancelar.
    expect(p.canCancel).toBe(true)
    // Derivado: §2 no ofrece "Reactivar" desde active (ya esta activa).
    expect(p.canReactivate).toBe(false)
  })

  it('past_due: panel limitado, solo lectura, storefront sigue abierto', () => {
    const p = derivePermissions('past_due')

    // Tabla: panel "⚠ Limitado", escritura ❌, tienda ✅.
    expect(p.canAccessPanel).toBe('limited')
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    // Derivado: §2 dice "acciones de escritura bloqueadas"; cancelar es una
    // transicion de estado, no una lectura. No se permite.
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(false)
  })

  it('cancelled: panel solo lectura, storefront hasta fin de periodo', () => {
    const p = derivePermissions('cancelled')

    // Tabla: panel "⚠ Solo lectura", tienda "✅ (hasta fin periodo)".
    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    // Derivado: §2 detalle dice que si se arrepiente antes de
    // current_period_end puede reactivar.
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(true)
  })

  it('expired: panel bloqueado, pero se puede reactivar', () => {
    const p = derivePermissions('expired')

    // Tabla: panel ❌, tienda ❌.
    expect(p.canAccessPanel).toBe('none')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    // Derivado: §2 detalle dice "panel bloqueado, muestra 'Cuenta
    // suspendida' + botón Reactivar".
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(true)
  })

  it('abandoned: registro incompleto, sin reactivacion (debe completar el pago)', () => {
    const p = derivePermissions('abandoned')

    // Tabla: panel ❌, tienda ❌.
    expect(p.canAccessPanel).toBe('none')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    expect(p.canCancel).toBe(false)
    // Derivado: §2 detalle dice "botón Completar pago", que es el flujo de
    // alta (preapproval), NO una reactivacion.
    expect(p.canReactivate).toBe(false)
  })
})

describe('derivePermissions — tabla completa (proteccion contra regresiones)', () => {
  // Un snapshot de la matriz entera. Si esto cambia, cambia la politica de
  // permisos del producto y tiene que ser una decision explicita.
  it('la matriz completa coincide con el transversal §2', () => {
    const rows = [
      'pending_first_payment',
      'active',
      'past_due',
      'cancelled',
      'expired',
      'abandoned',
    ] as const

    const snapshot = rows.map((status) => {
      const p = derivePermissions(status)
      return [
        status,
        p.canAccessPanel,
        p.canAccessStorefront,
        p.canWrite,
        p.canChangePlan,
        p.canCancel,
        p.canReactivate,
      ].join('|')
    })

    expect(snapshot).toEqual([
      'pending_first_payment|none|false|false|false|false|false',
      'active|full|true|true|true|true|false',
      'past_due|limited|true|false|false|false|false',
      'cancelled|readonly|true|false|false|false|true',
      'expired|none|false|false|false|false|true',
      'abandoned|none|false|false|false|false|false',
    ])
  })

  it('solo active puede escribir y cambiar de plan', () => {
    const rows = [
      'pending_first_payment',
      'active',
      'past_due',
      'cancelled',
      'expired',
      'abandoned',
    ] as const

    const canWrite = rows.filter((s) => derivePermissions(s).canWrite)
    const canChangePlan = rows.filter((s) => derivePermissions(s).canChangePlan)

    expect(canWrite).toEqual(['active'])
    expect(canChangePlan).toEqual(['active'])
  })

  it('el storefront solo queda abierto en active, past_due y cancelled', () => {
    const rows = [
      'pending_first_payment',
      'active',
      'past_due',
      'cancelled',
      'expired',
      'abandoned',
    ] as const

    const open = rows.filter((s) => derivePermissions(s).canAccessStorefront)

    expect(open).toEqual(['active', 'past_due', 'cancelled'])
  })
})
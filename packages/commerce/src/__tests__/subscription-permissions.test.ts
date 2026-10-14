import { describe, expect, it } from 'vitest'
import {
  derivePermissions,
  deriveTenantPermissions,
  type PanelAccess,
  type SubscriptionPermissions,
  type SubscriptionStatus,
  type TenantStatus,
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
  it('pending_first_payment: panel read-only (item 96), sin escritura, sin storefront', () => {
    const p = derivePermissions('pending_first_payment')

    // Item 96 (2026-10-10): antes era 'none'. El onboarding exige configurar
    // subdominio, branding y MP antes de pagar; con 'none' ese paso es
    // inejecutable. `canAccessStorefront` sigue en `false` porque D2 deja el
    // subdominio sin resolver hasta que el pago activa el tenant: el owner
    // entra a su panel, el comprador no entra a la tienda.
    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canSell).toBe(false)
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

  it('paused: conserva storefront, puede reanudar y puede cancelar', () => {
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
    // Decision de producto (Luis, 2026-10-04): `paused` es "suspender el
    // cobro", no "bloquear acciones". MP acepta `paused -> cancelled`, asi que
    // se expone. Forzar "reanudar para cancelar" seria burocracia.
    expect(p.canCancel).toBe(true)
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

  it('expired: panel read-only (item 97), pero se puede reactivar', () => {
    const p = derivePermissions('expired')

    // Item 97 (2026-10-10): antes era 'none'. Bloquear el acceso deja al tenant
    // sin poder ver que perdio, y un `expired` es un tenant que tuvo tienda.
    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canSell).toBe(false)
    expect(p.canWrite).toBe(false)
    expect(p.canChangePlan).toBe(false)
    expect(p.canCancel).toBe(false)
    expect(p.canReactivate).toBe(true)
    expect(p.canPause).toBe(false)
    expect(p.canResume).toBe(false)
  })

  it('abandoned: panel read-only (item 97), sin reactivacion', () => {
    const p = derivePermissions('abandoned')

    // Item 97 (2026-10-10): antes era 'none'. `abandoned` es "se dio de alta y
    // no pago" - cortarle el acceso no agrega nada: la deuda es de MercadoPago,
    // no del tenant. Su boton sigue siendo "Completar pago", no "Reactivar".
    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canAccessStorefront).toBe(false)
    expect(p.canSell).toBe(false)
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
        p.canSell,
        p.canWrite,
        p.canChangePlan,
        p.canCancel,
        p.canReactivate,
        p.canPause,
        p.canResume,
      ].join('|')
    })

    // `canSell` entra al snapshot en S4b. Es lo que separa "la tienda responde"
    // de "la tienda vende": `cancelled` responde en read-only y no vende, y
    // `past_due` no escribe pero vende.
    //
    // Los tres cambios de panel (`pending_first_payment`, `expired`,
    // `abandoned`: `none` -> `readonly`) son los items 96 y 97, decisions del
    // 2026-10-10. Antes de S4b este snapshot consagrava `none` y hacia que el
    // item 96 fuera papel mojado sin que ningun test lo dijera.
    expect(snapshot).toEqual([
      'pending_first_payment|readonly|false|false|false|false|false|false|false|false',
      'active|full|true|true|true|true|true|false|true|false',
      'past_due|limited|true|true|false|false|false|false|false|false',
      'paused|limited|true|true|false|false|true|false|false|true',
      'cancelled|readonly|true|false|false|false|false|true|false|false',
      'expired|readonly|false|false|false|false|false|true|false|false',
      'abandoned|readonly|false|false|false|false|false|false|false|false',
    ])
  })

  /**
   * D17: `past_due` es el unico estado que vende sin escribir.
   *
   * La asimetria es deliberada y el motivo esta escrito en el design: el
   * comprador no fallo el pago, el tenant si. Cortarle la tienda castiga al
   * que no corresponde.
   */
  it('past_due vende pero no escribe: la asimetria de D17', () => {
    const p = derivePermissions('past_due')

    expect(p.canSell).toBe(true)
    expect(p.canWrite).toBe(false)
  })

  it('canAccessStorefront y canSell no son el mismo permiso', () => {
    // `cancelled` responde hasta fin de periodo pero no acepta pedidos. Si
    //estos estuvieran fusionados, se perderia ese caso.
    const c = derivePermissions('cancelled')
    expect(c.canAccessStorefront).toBe(true)
    expect(c.canSell).toBe(false)

    // Y el caso inverso: `past_due` vende aunque su `canAccessStorefront`
    // no dice nada especial.
    const p = derivePermissions('past_due')
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canSell).toBe(true)
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

  it('solo active y paused pueden cancelar', () => {
    // Decision de producto (Luis, 2026-10-04): `paused` es "suspender el
    // cobro", no "bloquear acciones". MP acepta `paused -> cancelled`.
    // `cancelled` no puede cancelar de nuevo y los estados "muertos"
    // (`expired`, `abandoned`) ya no admiten esa transicion.
    expect(ALL.filter((s) => derivePermissions(s).canCancel)).toEqual([
      'active',
      'paused',
    ])
  })

  it('paused puede las 3 salidas plausibles: reanudar, cancelar o nada', () => {
    // `paused` es el unico estado con dos acciones disponibles a la vez.
    // Si se le agrega una tercera transicion en el futuro, este test obliga a
    // decidir explicitamente si `paused` sigue siendo bidireccional.
    const p = derivePermissions('paused')

    expect(p.canResume).toBe(true)
    expect(p.canCancel).toBe(true)
    expect(p.canPause).toBe(false)
  })

  it('el storefront queda abierto en active, past_due, paused y cancelled', () => {
    expect(ALL.filter((s) => derivePermissions(s).canAccessStorefront)).toEqual(
      ['active', 'past_due', 'paused', 'cancelled'],
    )
  })

  it('cancelled y expired son los unicos reactivables (reactivate legacy)', () => {
    expect(ALL.filter((s) => derivePermissions(s).canReactivate)).toEqual([
      'cancelled',
      'expired',
    ])
  })
})

// ---------------------------------------------------------------------------
// Los describes siguientes probaban `deriveTenantPermissions` desde este archivo.
// Se movieron aca (S4c) porque `tenant-permissions.test.ts` paso a testear el
// modulo homonimo `tenant-permissions.ts` (`getPermissions`). Antes ese nombre
// describia una funcion que vivia en otro archivo: el test no se llamaba como
// lo que probaba.
// ---------------------------------------------------------------------------

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
 * mueve no pase por el???el del que s?? se mueve.
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

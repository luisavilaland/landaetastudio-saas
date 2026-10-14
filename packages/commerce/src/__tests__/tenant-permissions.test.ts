import { describe, it, expect } from 'vitest'

import { getPermissions } from '../tenant-permissions'
import type {
  SubscriptionStatus,
  TenantStatus,
} from '../subscription-permissions'

/**
 * Tests de UNA sola capa, y la razon es la misma que en `tenant-lifecycle`:
 * `tenants` NO tiene RLS (es tabla raiz), asi que no hay una segunda capa de
 * proteccion que pueda ENMASCARAR un `WHERE` mal escrito. Si el filtro se
 * desvia, el test lo ve en una sola pasada.
 *
 * El mock del `tx` es local a proposito: `@repo/test-utils` no es dependencia
 * de `@repo/commerce` y ningun test del paquete lo importa. Agregarla solo
 * para esto moviria el lockfile sin ganar cobertura.
 */

function makeTx(
  tenant: TenantStatus | null,
  subscription: SubscriptionStatus | null,
): unknown {
  let call = 0
  const rows = () => (call++ === 0 ? tenant : subscription)

  const chain = (data: unknown[]) => ({
    from: () => chain(data),
    where: () => chain(data),
    limit: () => Promise.resolve(data),
  })

  return {
    select: () => {
      const s = rows()
      return chain(s === null ? [] : [{ status: s }])
    },
  }
}

function txWith(
  tenant: TenantStatus | null,
  subscription: SubscriptionStatus | null,
) {
  return makeTx(tenant, subscription)
}

describe('getPermissions', () => {
  it('tenant active + suscripcion active: acceso total', async () => {
    const p = await getPermissions(txWith('active', 'active') as never, 't1')

    expect(p.canWrite).toBe(true)
    expect(p.canSell).toBe(true)
    expect(p.canAccessPanel).toBe('full')
    expect(p.canAccessStorefront).toBe(true)
  })

  it('tenant active + suscripcion past_due: VENDE pero no publica (D17)', async () => {
    const p = await getPermissions(txWith('active', 'past_due') as never, 't1')

    // La asimetria que D17 define y que S4b dejo solo en la matriz.
    expect(p.canSell).toBe(true)
    expect(p.canWrite).toBe(false)
    expect(p.canAccessStorefront).toBe(true)
    expect(p.canAccessPanel).toBe('limited')
  })

  it('tenant pending + suscripcion pending_first_payment: panel read-only, sin vender', async () => {
    const p = await getPermissions(
      txWith('pending', 'pending_first_payment') as never,
      't1',
    )

    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canWrite).toBe(false)
    expect(p.canSell).toBe(false)
  })

  it('tenant active + suscripcion cancelled: storefront responde pero no vende', async () => {
    const p = await getPermissions(txWith('active', 'cancelled') as never, 't1')

    expect(p.canAccessStorefront).toBe(true)
    expect(p.canSell).toBe(false)
    expect(p.canWrite).toBe(false)
  })

  it('tenant active + suscripcion expired: read-only', async () => {
    const p = await getPermissions(txWith('active', 'expired') as never, 't1')

    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canWrite).toBe(false)
    expect(p.canSell).toBe(false)
  })

  it('tenant suspended: sin acceso, sin importar la suscripcion', async () => {
    const p = await getPermissions(txWith('suspended', 'active') as never, 't1')

    // El tenant manda sobre la suscripcion.
    expect(p.canAccessPanel).toBe('none')
    expect(p.canWrite).toBe(false)
    expect(p.canSell).toBe(false)
    expect(p.canAccessStorefront).toBe(false)
  })

  it('tenant que no existe: falla cerrado, sin acceso', async () => {
    const p = await getPermissions(txWith(null, 'active') as never, 'nope')

    expect(p.canAccessPanel).toBe('none')
    expect(p.canWrite).toBe(false)
    expect(p.canSell).toBe(false)
  })

  it('tenant sin suscripcion: asume pending_first_payment (item 96)', async () => {
    const p = await getPermissions(txWith('active', null) as never, 't1')

    // No `none`: el onboarding exige poder entrar a configurar branding antes
    // de pagar. Devolver sin acceso romperia el alta.
    expect(p.canAccessPanel).toBe('readonly')
    expect(p.canWrite).toBe(false)
    expect(p.canSell).toBe(false)
  })

  it('un tenant status desconocido tira en vez de devolver permisos', async () => {
    await expect(
      getPermissions(
        txWith('desconocido' as TenantStatus, 'active') as never,
        't1',
      ),
    ).rejects.toThrow(/unknown tenant status/)
  })

  it('un subscription status desconocido tambien tira', async () => {
    await expect(
      getPermissions(
        txWith('active', 'inventado' as SubscriptionStatus) as never,
        't1',
      ),
    ).rejects.toThrow(/unknown subscription status/)
  })
})
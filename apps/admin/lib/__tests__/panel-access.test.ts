import { describe, expect, it } from 'vitest'
import { decidePanelAccess } from '../panel-access'

/**
 * La decision de acceso es pura: estos tests fijan la matriz **sin** montar el
 * proxy ni la base. Si la matriz cambia en `@repo/commerce`, esto se rompe
 * antes de que un tenant suspendido entre al panel.
 */
describe('decidePanelAccess', () => {
  it('concede panel completo a un tenant active con suscripcion active', () => {
    expect(
      decidePanelAccess({ tenantStatus: 'active', subscriptionStatus: 'active' }),
    ).toEqual({
      access: 'full',
      tenantStatus: 'active',
      subscriptionStatus: 'active',
      reason: 'matrix',
    })
  })

  it('bloquea un tenant suspended aunque la suscripcion este active', () => {
    // El eje del tenant manda: es un bloqueo de plataforma, no una deuda.
    expect(
      decidePanelAccess({
        tenantStatus: 'suspended',
        subscriptionStatus: 'active',
      }),
    ).toEqual({
      access: 'none',
      tenantStatus: 'suspended',
      subscriptionStatus: 'active',
      reason: 'matrix',
    })
  })

  it.each([
    ['pending_first_payment', 'readonly'],
    ['expired', 'readonly'],
    ['abandoned', 'readonly'],
    ['cancelled', 'readonly'],
    ['past_due', 'limited'],
    ['paused', 'limited'],
  ])('deja pasar en %s con acceso %s', (subscriptionStatus, expected) => {
    expect(
      decidePanelAccess({ tenantStatus: 'active', subscriptionStatus }),
    ).toMatchObject({ access: expected, reason: 'matrix' })
  })

  it('deja pasar un tenant cancelled en readonly, no lo bloquea', () => {
    expect(
      decidePanelAccess({
        tenantStatus: 'cancelled',
        subscriptionStatus: 'active',
      }),
    ).toMatchObject({ access: 'readonly', reason: 'matrix' })
  })

  it('sin tenant devuelve none con reason missing_tenant', () => {
    // Una fila ausente en el lado izquierdo del join no es "tenant sin
    // suscripcion": es un tenant que la query no encontro.
    expect(decidePanelAccess({ tenantStatus: null, subscriptionStatus: null }))
      .toMatchObject({ access: 'none', reason: 'missing_tenant' })
  })

  it('sin suscripcion deja readonly, no bloquea el panel', () => {
    expect(
      decidePanelAccess({ tenantStatus: 'active', subscriptionStatus: null }),
    ).toEqual({
      access: 'readonly',
      tenantStatus: 'active',
      subscriptionStatus: 'unknown',
      reason: 'missing_subscription',
    })
  })

  it('bloquea un tenant suspended aunque no tenga fila de suscripcion', () => {
    // Sin esto, suspender un tenant que nunca pago dejaba el panel abierto: la
    // fila ausente cortaba el camino antes de llegar a los overrides del eje
    // del tenant, y el `readonly` de un tenant `active` se aplicaba a todos.
    expect(
      decidePanelAccess({ tenantStatus: 'suspended', subscriptionStatus: null }),
    ).toEqual({
      access: 'none',
      tenantStatus: 'suspended',
      subscriptionStatus: 'unknown',
      reason: 'missing_subscription',
    })
  })

  it('sin suscripcion los overrides del tenant siguen mandando', () => {
    expect(
      decidePanelAccess({ tenantStatus: 'cancelled', subscriptionStatus: null }),
    ).toMatchObject({ access: 'readonly', reason: 'missing_subscription' })
  })

  it('propaga el throw de un estado de suscripcion desconocido', () => {
    expect(() =>
      decidePanelAccess({
        tenantStatus: 'active',
        subscriptionStatus: 'un_estado_que_no_existe',
      }),
    ).toThrow(/unknown subscription status/)
  })

  it('propaga el throw de un estado de tenant desconocido', () => {
    expect(() =>
      decidePanelAccess({
        tenantStatus: 'un_estado_que_no_existe',
        subscriptionStatus: 'active',
      }),
    ).toThrow(/unknown tenant status/)
  })

  it('no cae en las claves heredadas de Object.prototype', () => {
    // Item 118: `constructor` y `toString` son truthy y pasaban el guard de
    // `undefined`. Aca tienen que lanzar igual que cualquier estado invalido.
    expect(() =>
      decidePanelAccess({ tenantStatus: 'active', subscriptionStatus: 'constructor' }),
    ).toThrow(/unknown subscription status/)
    expect(() =>
      decidePanelAccess({ tenantStatus: 'toString', subscriptionStatus: 'active' }),
    ).toThrow(/unknown tenant status/)
  })
})

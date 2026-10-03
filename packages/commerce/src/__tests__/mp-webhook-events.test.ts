import { describe, expect, it } from 'vitest'
import { classifyMpEvent, type MpTopic } from '../mp-webhook-events'

// Fuente: docs/superpowers/specs/2026-09-subscription-lifecycle.md §6
// ("Topics reales de MercadoPago").
//
// ADVERTENCIA IMPORTANTE: los literales exactos de `type` y `action` NO se
// pudieron capturar. El spike T0 (2026-10-02) no recibio ni un solo webhook
// de suscripciones, asi que la tabla de mapeo de abajo esta construida a
// partir de la documentacion de MP, no de evidencia de payloads reales.
//
// Este archivo es el UNICO punto donde se fijan los literales. Cuando T5
// capture un payload real en produccion, se actualiza ESTE archivo y sus
// tests en un commit dedicado. No dispersar el mapeo por los handlers.
describe('classifyMpEvent', () => {
  it('reconoce subscription_preapproval', () => {
    expect(classifyMpEvent('subscription_preapproval', 'any.action')).toBe(
      'subscription_preapproval',
    )
  })

  it('reconoce subscription_authorized_payment', () => {
    expect(
      classifyMpEvent('subscription_authorized_payment', 'any.action'),
    ).toBe('subscription_authorized_payment')
  })

  it('reconoce payment', () => {
    expect(classifyMpEvent('payment', 'payment.created')).toBe('payment')
  })

  it('reconoce subscription_preapproval_plan', () => {
    expect(classifyMpEvent('subscription_preapproval_plan', undefined)).toBe(
      'subscription_preapproval_plan',
    )
  })

  it('type desconocido -> UNKNOWN (no es un error)', () => {
    expect(classifyMpEvent('invoice', 'payment.created')).toBe('UNKNOWN')
  })

  it('type vacio o undefined -> UNKNOWN', () => {
    expect(classifyMpEvent('', 'payment.created')).toBe('UNKNOWN')
    expect(classifyMpEvent(undefined, 'payment.created')).toBe('UNKNOWN')
  })

  it('type y action ausentes -> UNKNOWN', () => {
    expect(classifyMpEvent(undefined, undefined)).toBe('UNKNOWN')
    expect(classifyMpEvent('', '')).toBe('UNKNOWN')
  })

  it('el action nunca pisa un type conocido', () => {
    // El §6 dice despachar por `type`. Un action raro no debe degradar un
    // topic que ya se identifico.
    expect(
      classifyMpEvent('payment', 'subscription_preapproval.updated'),
    ).toBe('payment')
  })

  it('cae al action cuando el type no aporta nada', () => {
    // MercadoPago manda `type` y `action` separados; hay combinaciones donde
    // el type es generico. El action se usa como fallback, no como override.
    expect(classifyMpEvent('unknown_type', 'subscription_preapproval')).toBe(
      'subscription_preapproval',
    )
    expect(classifyMpEvent('', 'subscription_authorized_payment')).toBe(
      'subscription_authorized_payment',
    )
    expect(classifyMpEvent(undefined, 'payment')).toBe('payment')
  })

  it('normaliza mayusculas y espacios', () => {
    expect(classifyMpEvent('SUBSCRIPTION_PREAPPROVAL', undefined)).toBe(
      'subscription_preapproval',
    )
    expect(classifyMpEvent('  payment  ', undefined)).toBe('payment')
  })

  it('UNKNOWN es un resultado valido, no una excepcion', () => {
    const topic: MpTopic = classifyMpEvent('algo.raro', 'otra.cosa')
    expect(topic).toBe('UNKNOWN')
  })

  it('clasifica sin lanzar ante entradas no-string', () => {
    // El body viene de una request externa: no se puede asumir el tipo.
    expect(() =>
      classifyMpEvent(
        123 as unknown as string,
        ['a'] as unknown as string,
      ),
    ).not.toThrow()
  })
})
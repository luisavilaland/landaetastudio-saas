import { describe, expect, it } from 'vitest'
import { calculateProration } from '../subscription-proration'

// Fuente: docs/superpowers/specs/2026-09-subscription-lifecycle.md §5
// ("Prorrateo en cambio de plan").
//
// Formula (textual del §5):
//   credito = (precioActual x diasRestantes / diasPeriodo)
//           - (precioNuevo   x diasRestantes / diasPeriodo)
//
// CONVENCION DE SIGNOS (segun §5, notas sobre la formula):
//   credito > 0 -> el tenant tiene saldo a favor (downgrade)
//   credito < 0 -> el tenant debe una diferencia (upgrade)
//
// Precios en CENTAVOS (integer), nunca float hacia el usuario.
const MS_PER_DAY = 86_400_000
const DAY = MS_PER_DAY

const NOW = new Date('2026-10-01T12:00:00.000Z')

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY)
}

// Precios del transversal §5 (UYU 4.000 y UYU 8.000 -> centavos).
const PRO = 400_000
const BUSINESS = 800_000

describe('calculateProration', () => {
  it('upgrade con medio periodo restante: el tenant debe la diferencia (dia 15)', () => {
    // Ejemplo textual del §5: Pro -> Business, dia 15 de un mes de 30.
    //   Pro rateado      = 400000 x 15/30 = 200000
    //   Business rateado = 800000 x 15/30 = 400000
    //   diferencia       = 200000 - 400000 = -200000  (debe)
    const result = calculateProration({
      currentPriceUyu: PRO,
      newPriceUyu: BUSINESS,
      currentPeriodEnd: daysFromNow(15),
      now: NOW,
    })

    expect(result.proratedAmountCents).toBe(-200_000)
    expect(result.direction).toBe('upgrade')
    expect(result.daysRemaining).toBe(15)
  })

  it('downgrade con medio periodo restante: el tenant queda con saldo a favor', () => {
    // §5: Business -> Pro, dia 15. Credito a favor UYU 2.000 = 200000 centavos.
    const result = calculateProration({
      currentPriceUyu: BUSINESS,
      newPriceUyu: PRO,
      currentPeriodEnd: daysFromNow(15),
      now: NOW,
    })

    expect(result.proratedAmountCents).toBe(200_000)
    expect(result.direction).toBe('downgrade')
    expect(result.daysRemaining).toBe(15)
  })

  it('upgrade el dia 1 (29 dias restantes): redondea a entero', () => {
    //   400000 x 29/30 = 386666.666...
    //   800000 x 29/30 = 773333.333...
    //   diferencia     = -386666.666... -> redondeo a -386667
    const result = calculateProration({
      currentPriceUyu: PRO,
      newPriceUyu: BUSINESS,
      currentPeriodEnd: daysFromNow(29),
      now: NOW,
    })

    expect(result.daysRemaining).toBe(29)
    expect(result.direction).toBe('upgrade')
    expect(result.proratedAmountCents).toBe(-386_667)
    expect(Number.isInteger(result.proratedAmountCents)).toBe(true)
  })

  it('periodo completo: prorratea el periodo entero, no cero', () => {
    // OJO: con 30 dias restantes el §5 multiplica por 30/30, o sea los
    // precios completos. El resultado NO es 0: cambiar de plan con el
    // periodo entero por delante tiene un costo real.
    //   400000 x 30/30 - 800000 x 30/30 = -400000
    const result = calculateProration({
      currentPriceUyu: PRO,
      newPriceUyu: BUSINESS,
      currentPeriodEnd: daysFromNow(30),
      now: NOW,
    })

    expect(result.daysRemaining).toBe(30)
    expect(result.direction).toBe('upgrade')
    expect(result.proratedAmountCents).toBe(-400_000)
  })

  it('mismo precio: sin diferencia y direction same', () => {
    const result = calculateProration({
      currentPriceUyu: PRO,
      newPriceUyu: PRO,
      currentPeriodEnd: daysFromNow(15),
      now: NOW,
    })

    expect(result.proratedAmountCents).toBe(0)
    expect(result.direction).toBe('same')
    expect(result.daysRemaining).toBe(15)
  })

  it('periodo vencido: error de dominio, no un 0 silencioso', () => {
    // El §5 no cubre el periodo vencido. Un 0 silencioso se interpretaria
    // como "no hay nada que cobrar", que es un falso exito.
    expect(() =>
      calculateProration({
        currentPriceUyu: PRO,
        newPriceUyu: BUSINESS,
        currentPeriodEnd: daysFromNow(-1),
        now: NOW,
      }),
    ).toThrow(/periodo ya vencio/i)
  })

  it('periodo que termina justo ahora: tambien error de dominio', () => {
    expect(() =>
      calculateProration({
        currentPriceUyu: PRO,
        newPriceUyu: BUSINESS,
        currentPeriodEnd: NOW,
        now: NOW,
      }),
    ).toThrow(/periodo ya vencio/i)
  })

  it('diasRestantes parciales se redondean hacia arriba (ceil)', () => {
    // 10.5 dias restantes -> ceil -> 11 dias de prorrateo.
    const result = calculateProration({
      currentPriceUyu: PRO,
      newPriceUyu: BUSINESS,
      currentPeriodEnd: new Date(NOW.getTime() + 10.5 * DAY),
      now: NOW,
    })

    expect(result.daysRemaining).toBe(11)
  })

  it('respeta daysPerPeriod cuando se pasa explicito', () => {
    // Con un periodo de 60 dias y 30 restantes, la fraccion es 30/60.
    //   400000 x 30/60 - 800000 x 30/60 = 200000 - 400000 = -200000
    const result = calculateProration({
      currentPriceUyu: PRO,
      newPriceUyu: BUSINESS,
      currentPeriodEnd: daysFromNow(30),
      now: NOW,
      daysPerPeriod: 60,
    })

    expect(result.proratedAmountCents).toBe(-200_000)
    expect(result.daysRemaining).toBe(30)
  })

  it('es pura: mismo input, mismo output, sin reloj interno', () => {
    const input = {
      currentPriceUyu: PRO,
      newPriceUyu: BUSINESS,
      currentPeriodEnd: daysFromNow(20),
      now: NOW,
    }

    const a = calculateProration(input)
    const b = calculateProration(input)

    expect(a).toEqual(b)
    // El input no se muta.
    expect(input.currentPeriodEnd).toEqual(daysFromNow(20))
  })
})
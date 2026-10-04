import { describe, expect, it } from 'vitest'
import { fromMpAmount, toMpAmount } from '../mp-amounts'

// El bug que estos helpers previenen (item 48): `POST /preapproval` mando
// `transactionAmount: 4900` en vez de `49`, o sea 100x de sobrecobro. Ningun test
// de integracion lo atrapo; lo atrapo un test de contrato de este borde.

describe('toMpAmount (centavos -> unidad de moneda)', () => {
  it('convierte 4900 centavos en 49 UYU', () => {
    expect(toMpAmount(4900)).toBe(49)
  })

  it('conserva decimales cuando corresponde', () => {
    expect(toMpAmount(1234)).toBe(12.34)
    expect(toMpAmount(811)).toBe(8.11)
  })

  it('devuelve 0 para 0 y para el menor centavo posible', () => {
    expect(toMpAmount(0)).toBe(0)
    expect(toMpAmount(1)).toBe(0.01)
  })
})

describe('fromMpAmount (unidad de moneda -> centavos)', () => {
  it('convierte 49 UYU en 4900 centavos', () => {
    expect(fromMpAmount(49)).toBe(4900)
  })

  it('redondea a entero: centavos son enteros por contrato', () => {
    expect(fromMpAmount(12.34)).toBe(1234)
    expect(fromMpAmount(0.01)).toBe(1)
  })
})

describe('precision: Math.round en fromMpAmount es load-bearing', () => {
  // Sin Math.round, (29/100)*100 da 28.999999999999996 en coma flotante
  // binaria y el roundtrip devuelve 28.999... en vez de 29.
  it('29 centavos sobreviven al roundtrip (falla sin Math.round)', () => {
    // El valor crudo, para dejar constancia de por que existe el round:
    expect((29 / 100) * 100).not.toBe(29)

    expect(fromMpAmount(toMpAmount(29))).toBe(29)
  })

  it('redondea correctamente en todos los casos que rompen sin round', () => {
    // Estos valores son los que fallan con multiplicacion simple.
    const fragiles = [29, 57, 58, 705, 811, 1234, 10050]

    for (const cents of fragiles) {
      expect(fromMpAmount(toMpAmount(cents))).toBe(cents)
    }
  })
})

describe('roundtrip', () => {
  it('vuelve al valor original para precios realistas', () => {
    const precios = [0, 1, 99, 100, 4900, 2900, 9000, 10050, 123456]

    for (const cents of precios) {
      expect(fromMpAmount(toMpAmount(cents))).toBe(cents)
    }
  })

  it('la ida y la vuelta son inversas exactas, no aproximadas', () => {
    // Si esto fallara, estariamos roundtrippeando a un valor cercano pero
    // distinto, que es peor que no roundtrippear: no se nota en los logs.
    for (let cents = 0; cents <= 2000; cents += 7) {
      expect(fromMpAmount(toMpAmount(cents))).toBe(cents)
    }
  })

  it('aguanta un barrido amplio de precios en centavos', () => {
    // 200 valores, incluidos los que no son multiplos de 100.
    for (let cents = 100; cents <= 20000; cents += 101) {
      expect(fromMpAmount(toMpAmount(cents))).toBe(cents)
    }
  })
})

describe('el error del 100x que este helper previene', () => {
  it('toMpAmount(4900) es 49, no 4900', () => {
    // La asercion que habria fallado antes del fix.
    expect(toMpAmount(4900)).not.toBe(4900)
    expect(toMpAmount(4900)).toBe(49)
  })

  it('los dos helpers son inversos y no hay perdida de centavo', () => {
    expect(toMpAmount(fromMpAmount(49))).toBe(49)
  })
})
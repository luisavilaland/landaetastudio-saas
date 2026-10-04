/**
 * Conversiones entre nuestra convencion interna y la de MercadoPago.
 *
 * Nuestra persistencia trabaja en **centavos** (integer) por convencion de
 * `AGENTS.md`. La API de MercadoPago espera el monto **en la unidad de la
 * moneda**: `transaction_amount: 49`, no `4900`.
 *
 * El bug del 100x en `POST /api/subscriptions/preapproval` (T4, PR #189) fue
 * exactamente esto: una division por 100 escrita a mano que nadie reviso como
 * conversion de unidades. Estos helpers existen para que la conversion no
 * dependa de que alguien se acuerde.
 *
 * @see Item 48 de `vault/03_Deuda/deuda-tecnica.md`
 */

/**
 * Centavos -> unidad de moneda (lo que espera MercadoPago).
 *
 * 4900 -> 49
 *
 * Sin validacion a proposito: el unico llamador legitimo es el borde de la API,
 * donde el valor viene de `plans.priceUyu`. Agregar guards aqui daria la falsa
 * sensacion de que el problema es de entrada invalida cuando el problema real es
 * de unidad.
 */
export function toMpAmount(cents: number): number {
  return cents / 100
}

/**
 * Unidad de moneda -> centavos (lo que guardamos).
 *
 * `Math.round` es **load-bearing, no decorativo**. Sin el, el roundtrip se
 * rompe en casos reales:
 *
 * ```ts
 * (29 / 100) * 100 // 28.999999999999996  <- float binario
 * Math.round(28.999999999999996) // 29    <- correcto
 * ```
 *
 * Sin el round, `fromMpAmount(toMpAmount(29))` devolveria 28.999... y cualquier
 * comparacion contra un entero de la DB fallaria.
 *
 * Solo recibe montos de MP, que tienen 2 decimales: multiplicar por 100 siempre
 * da un entero matematicamente, asi que el `round` solo corrige el error de
 * representacion binaria, nunca un valor genuinamente fraccionario.
 */
export function fromMpAmount(mpAmount: number): number {
  return Math.round(mpAmount * 100)
}
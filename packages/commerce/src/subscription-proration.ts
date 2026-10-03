/**
 * Prorrateo en cambio de plan.
 *
 * Fuente de verdad: `docs/superpowers/specs/2026-09-subscription-lifecycle.md`
 * seccion 5 ("Prorrateo en cambio de plan").
 *
 * Funcion pura a proposito: `now` es inyectable, no hay `Date.now()` interno,
 * no hay red y no hay DB. Se testea sin reloj real y sin MercadoPago.
 *
 * Convencion de signos (segun las notas de la formula en el seccion 5):
 *   proratedAmountCents > 0 -> el tenant tiene saldo a favor (downgrade)
 *   proratedAmountCents < 0 -> el tenant debe una diferencia (upgrade)
 *
 * Todos los precios son centavos enteros (AGENTS.md). El redondeo a entero
 * ocurre una sola vez, sobre el resultado.
 */

const MS_PER_DAY = 86_400_000

const DEFAULT_DAYS_PER_PERIOD = 30

export interface ProrationInput {
  /** Precio mensual actual, en centavos. */
  currentPriceUyu: number
  /** Precio mensual nuevo, en centavos. */
  newPriceUyu: number
  /** Fin del periodo que ya se pago. */
  currentPeriodEnd: Date
  /** Instante de referencia. Inyectado para que la funcion sea pura. */
  now: Date
  /** Duracion del periodo de cobro. Por defecto 30 (mes). */
  daysPerPeriod?: number
}

export type ProrationDirection = 'upgrade' | 'downgrade' | 'same'

export interface ProrationResult {
  /**
   * Centavos a cobrar (>0, upgrade) o saldo a favor (<0, downgrade).
   * Negativo = el tenant debe; positivo = el tenant tiene credito.
   */
  proratedAmountCents: number
  direction: ProrationDirection
  /** Dias enteros que quedan del periodo ya pagado. */
  daysRemaining: number
}

/**
 * Calcula la diferencia a cobrar o el credito a favor de un cambio de plan.
 *
 * Formula (textual del seccion 5):
 *   credito = (precioActual x diasRestantes / diasPeriodo)
 *           - (precioNuevo   x diasRestantes / diasPeriodo)
 *
 * @throws si el periodo ya vencio (`currentPeriodEnd <= now`). El seccion 5 no
 * cubre ese caso y un 0 silencioso se interpretaria como "no hay nada que
 * cobrar", que es un falso exito: el endpoint terminaria confirmando un cambio
 * de plan que no se cobro.
 * @throws si `daysPerPeriod` no es un entero positivo.
 */
export function calculateProration(input: ProrationInput): ProrationResult {
  const { currentPriceUyu, newPriceUyu, currentPeriodEnd, now } = input
  const daysPerPeriod = input.daysPerPeriod ?? DEFAULT_DAYS_PER_PERIOD

  if (!Number.isInteger(daysPerPeriod) || daysPerPeriod <= 0) {
    throw new Error(
      `calculateProration: daysPerPeriod must be a positive integer, got ${String(daysPerPeriod)}`,
    )
  }

  const remainingMs = currentPeriodEnd.getTime() - now.getTime()

  if (remainingMs <= 0) {
    throw new Error(
      'calculateProration: el periodo ya vencio, no aplica prorrateo',
    )
  }

  // ceil: si queda media hora, todavia hay un dia de servicio que cobrar.
  const daysRemaining = Math.ceil(remainingMs / MS_PER_DAY)
  const fraction = daysRemaining / daysPerPeriod

  const proratedAmountCents = Math.round(
    (currentPriceUyu - newPriceUyu) * fraction,
  )

  const direction: ProrationDirection =
    newPriceUyu > currentPriceUyu
      ? 'upgrade'
      : newPriceUyu < currentPriceUyu
        ? 'downgrade'
        : 'same'

  return { proratedAmountCents, direction, daysRemaining }
}
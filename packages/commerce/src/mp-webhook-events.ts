/**
 * Clasificacion de topics del webhook de MercadoPago.
 *
 * Fuente de verdad: `docs/superpowers/specs/2026-09-subscription-lifecycle.md`
 * seccion 6 ("Topics reales de MercadoPago").
 *
 * ESTE ES EL UNICO PUNTO DEL CODIGO DONDE SE FIJAN LOS LITERALES DE TOPIC.
 * Cuando T5 capture un payload real en produccion, se actualiza ESTE archivo y
 * sus tests en un commit dedicado. No dispersar el mapeo por los handlers: el
 * punto de tener un clasificador propio es que haya un solo lugar que corregir.
 *
 * ADVERTENCIA: los literales exactos de `type` y `action` NO estan verificados
 * con evidencia. El spike T0 (2026-10-02) no recibio un solo webhook de
 * suscripciones, asi que la tabla sale de la documentacion de MP. Por eso el
 * clasificador es tolerante: una combinacion desconocida produce `UNKNOWN`, que
 * es una RESPUESTA VALIDA, no un error. El handler deberia responder 200 con un
 * log `warn` y no escribir nada.
 */

export type MpTopic =
  | 'subscription_preapproval'
  | 'subscription_authorized_payment'
  | 'payment'
  | 'subscription_preapproval_plan'
  | 'UNKNOWN'

const TOPIC_BY_TYPE: Readonly<Record<string, MpTopic>> = {
  subscription_preapproval: 'subscription_preapproval',
  subscription_authorized_payment: 'subscription_authorized_payment',
  payment: 'payment',
  subscription_preapproval_plan: 'subscription_preapproval_plan',
}

const TOPIC_BY_ACTION: Readonly<Record<string, MpTopic>> = {
  subscription_preapproval: 'subscription_preapproval',
  subscription_authorized_payment: 'subscription_authorized_payment',
  payment: 'payment',
  subscription_preapproval_plan: 'subscription_preapproval_plan',
}

/**
 * Normaliza un valor vindo del body del webhook sin asumir su tipo.
 * El body viene de una request externa: puede faltar, venir con espacios o con
 * otro tipo entirely.
 */
function normalize(value: string | undefined): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

/**
 * Clasifica un evento entrante de MercadoPago en un topic conocido.
 *
 * Prioridad: `type` primero (el transversal seccion 6 indica despachar por
 * `type`, que es el campo mas estable). `action` acts ONLY como fallback cuando
 * el `type` no aporta un topic conocido: un `action` raro nunca debe degradar un
 * `type` que ya se identifico.
 *
 * @returns el topic, o `'UNKNOWN'` si la combinacion no es reconocible. Nunca
 * lanza: una notificacion que no entendemos no puede romper el endpoint.
 */
export function classifyMpEvent(
  type: string | undefined,
  action: string | undefined,
): MpTopic {
  const byType = normalize(type)
  if (byType && TOPIC_BY_TYPE[byType]) {
    return TOPIC_BY_TYPE[byType]
  }

  const byAction = normalize(action)
  if (byAction && TOPIC_BY_ACTION[byAction]) {
    return TOPIC_BY_ACTION[byAction]
  }

  return 'UNKNOWN'
}
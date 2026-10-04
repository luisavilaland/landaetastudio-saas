/**
 * Clasificacion de topics del webhook de MercadoPago.
 *
 * Fuente de verdad: `docs/superpowers/specs/2026-09-subscription-lifecycle.md`
 * seccion 6 ("Topics reales de MercadoPago"), con los literales confirmados por
 * el spike T0 re-ejecutado (`docs/superpowers/specs/2026-10-02-spike-t0-resultado.md`,
 * seccion "Resultados finales 2026-10-03").
 *
 * ESTE ES EL UNICO PUNTO DEL CODIGO DONDE SE FIJAN LOS LITERALES DE TOPIC.
 * No dispersar el mapeo por los handlers: el punto de tener un clasificador
 * propio es que haya un solo lugar que corregir.
 *
 * **VERIFICADO CONTRA PAYLOAD REAL (2026-10-03).** El spike capturo tres
 * eventos en produccion y los `type` coinciden con los literales de abajo.
 * Antes de esa fecha el mapeo venia de la documentacion de MP y esta nota
 * advertia que no estaba verificado.
 *
 * Dos formas de payload, relevantes para el que despacha:
 *
 * | Topic                             | `topLevelKeys`                                                          | `live_mode` |
 * | --------------------------------- | ----------------------------------------------------------------------- | ----------- |
 * | `payment`                         | `action, api_version, data, date_created, id, live_mode, type, user_id`  | **presente**|
 * | `subscription_authorized_payment` | `action, application_id, data, date, entity, id, type, version`          | **ausente**  |
 * | `subscription_preapproval`        | `action, application_id, data, date, entity, id, type, version`          | **ausente**  |
 *
 * **`data.id` significa tres cosas distintas segun el topic:** en `payment` es
 * un id de pago (`GET /v1/payments/{id}`), en `subscription_authorized_payment`
 * es un id de **invoice** (`GET /authorized_payments/{id}`) y en
 * `subscription_preapproval` es el id del preapproval (`GET /preapproval/{id}`).
 *
 * El clasificador sigue siendo tolerante: una combinacion desconocida produce
 * `UNKNOWN`, que es una RESPUESTA VALIDA, no un error.
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
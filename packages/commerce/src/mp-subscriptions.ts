/**
 * Cliente HTTP de MercadoPago para el flujo de suscripciones (Flujo A).
 *
 * NO usar para ordenes de tienda: ese flujo usa el token del tenant
 * (descifrado de `tenant_mp_config`) y vive en `apps/storefront`. Aqui se usa
 * el token de la PLATAFORMA (`MP_PLATFORM_ACCESS_TOKEN`). Ver
 * `docs/superpowers/specs/2026-09-subscription-lifecycle.md` seccion 8.
 *
 * Este modulo es un wrapper de I/O: arma la request, aplica el timeout y
 * normaliza el error. NO contiene logica de negocio ni transiciones de estado.
 * Eso vive en los handlers (T4) y en el webhook (T5).
 *
 * Se prueba indirectamente, con `fetch` mockeado, desde los tests de T4/T5.
 */

const MP_API_BASE_URL = 'https://api.mercadopago.com'

const USER_AGENT = 'SaaS-eCommerce/1.0'

/**
 * Timeout por defecto. 30s para `POST /preapproval`, que es la llamada mas
 * lenta (MP procesa el alta). Los GET pueden bajar a 15s si hace falta.
 */
const DEFAULT_TIMEOUT_MS = 30_000

/** Error normalizado de MercadoPago, para que los handlers puedan mapearlo a un status HTTP. */
export interface MercadoPagoApiError extends Error {
  /** Status HTTP de la respuesta de MP, o 0 si el fallo fue de red / timeout. */
  status: number
  /** `true` si el error fue timeout o fallo de red (no respuesta de MP). */
  isNetworkError: boolean
}

function toApiError(
  message: string,
  status: number,
  isNetworkError: boolean,
): MercadoPagoApiError {
  const error = new Error(message) as MercadoPagoApiError
  error.name = 'MercadoPagoApiError'
  error.status = status
  error.isNetworkError = isNetworkError
  return error
}

/** Extrae el mensaje de error de MP sin asumir la forma del body. */
function extractMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>
    const message = record.message
    if (typeof message === 'string' && message.length > 0) return message
    const cause = record.cause
    if (typeof cause === 'string' && cause.length > 0) return cause
  }
  return fallback
}

async function mpRequest<T>(
  path: string,
  token: string,
  init: { method: 'GET' | 'POST' | 'PUT'; body?: unknown },
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${MP_API_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    })

    // MP devuelve 204 en algunos PATCH/PUT sin cuerpo.
    const raw = await response.text()
    let parsed: unknown = null
    if (raw.length > 0) {
      try {
        parsed = JSON.parse(raw) as unknown
      } catch {
        parsed = null
      }
    }

    if (!response.ok) {
      throw toApiError(
        extractMessage(parsed, `MercadoPago respondio ${response.status}`),
        response.status,
        false,
      )
    }

    return parsed as T
  } catch (error) {
    if (error instanceof Error && error.name === 'MercadoPagoApiError') {
      throw error
    }
    // AbortError = timeout. Cualquier otra excepcion de fetch = red.
    const isAbort = error instanceof Error && error.name === 'AbortError'
    const reason = isAbort ? `timeout de ${timeoutMs}ms` : 'fallo de red'
    throw toApiError(
      `MercadoPago: ${reason} (${path})`,
      0,
      true,
    )
  } finally {
    clearTimeout(timeout)
  }
}

/** Payload de alta de preapproval. Campos segun la API de Suscripciones de MP. */
export interface CreatePreapprovalInput {
  reason: string
  payerEmail: string
  /** En centavos, sin dividir (AGENTS.md). */
  transactionAmount: number
  currencyId: string
  externalReference: string
  backUrl: string
  /**
   * OJO: el spike T0 (2026-10-02) verifico que MP ACEPTA el campo y lo
   * DESCARTA en silencio: un GET posterior no lo muestra. Se envia igual
   * porque no hace daño, pero la URL del webhook se registra en el panel de MP.
   */
  notificationUrl?: string
  autoRecurring: {
    frequency: number
    frequencyType: 'months' | 'days'
  }
}

/** Alta de un preapproval de suscripcion en la cuenta de plataforma. */
export function createPreapproval(
  input: CreatePreapprovalInput,
  token: string,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  return mpRequest(
    '/preapproval',
    token,
    {
      method: 'POST',
      body: {
        reason: input.reason,
        payer_email: input.payerEmail,
        external_reference: input.externalReference,
        back_url: input.backUrl,
        notification_url: input.notificationUrl,
        status: 'pending',
        auto_recurring: {
          frequency: input.autoRecurring.frequency,
          frequency_type: input.autoRecurring.frequencyType,
          transaction_amount: input.transactionAmount,
          currency_id: input.currencyId,
        },
      },
    },
    timeoutMs,
  )
}

/** Actualizacion parcial de un preapproval. */
export function updatePreapproval(
  id: string,
  patch: { transactionAmount?: number; status?: string },
  token: string,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  return mpRequest(
    `/preapproval/${id}`,
    token,
    {
      method: 'PUT',
      body: {
        ...(patch.transactionAmount !== undefined && {
          auto_recurring: { transaction_amount: patch.transactionAmount },
        }),
        ...(patch.status !== undefined && { status: patch.status }),
      },
    },
    timeoutMs,
  )
}

/**
 * Lectura del estado real de un preapproval.
 *
 * Es la UNICA fuente de verdad sobre el estado: el spike T0 demostro que MP
 * devuelve 2xx al descartar campos sin avisar, asi que un 2xx de
 * `updatePreapproval` no prueba que la operacion se aplico.
 */
export function getPreapproval(
  id: string,
  token: string,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  return mpRequest(`/preapproval/${id}`, token, { method: 'GET' }, timeoutMs)
}

/**
 * Lectura de una invoice de suscripcion (`GET /authorized_payments/{id}`).
 *
 * NO confundir con `/v1/payments/{id}`: el spike T0 (P3) verifico que
 * `authorized_payments` expone `preapproval_id` y `external_reference`, que es
 * justamente el cruce que necesita la resolucion de tenant.
 */
export function getAuthorizedPayment(
  id: string,
  token: string,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  return mpRequest(
    `/authorized_payments/${id}`,
    token,
    { method: 'GET' },
    timeoutMs,
  )
}

/** Exportado para que los tests puedan apuntar a un doble sin reimplementar la aritmetica. */
export const MP_API = {
  baseUrl: MP_API_BASE_URL,
  userAgent: USER_AGENT,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
} as const
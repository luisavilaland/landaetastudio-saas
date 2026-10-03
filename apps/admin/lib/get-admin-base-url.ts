import type { NextRequest } from 'next/server'

/**
 * Deriva la URL base del panel admin a partir del request entrante.
 *
 * Espejo de `getStorefrontBaseUrl` (apps/storefront/lib/request.ts): la URL
 * publica se construye con `x-forwarded-proto` + `host`, nunca con una variable
 * de entorno fija. Cada despliegue de Vercel tiene su propio dominio y el
 * request entrante es la unica fuente de verdad.
 *
 * Se usa para las `back_urls` y `notification_url` que se le mandan a
 * MercadoPago en el alta de suscripciones.
 *
 * @throws si el request no trae header `host`: sin el, la URL quedaria
 * `https://` y el webhook se registraria en un destino invalido. Es preferible
 * fallar en el request que registrar un webhook que nunca va a recibir nada.
 */
export function getAdminBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host')

  if (!host) {
    throw new Error('getAdminBaseUrl: request is missing the host header')
  }

  // Vercel (y otros proxies) pueden enviar la cadena como lista separada por
  // comas: "https,http". El primer valor es el protocolo original.
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const proto = (forwardedProto?.split(',')[0]?.trim() || 'https') as
    | 'http'
    | 'https'

  return `${proto}://${host}`
}
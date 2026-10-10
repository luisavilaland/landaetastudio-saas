/**
 * S3 / T8 / D8: validacion y reserva de slugs de tenant.
 *
 * ## Por que vive aca y no en `@repo/validation`
 *
 * La lista de reservados no es un schema de request: es una regla de negocio de
 * multi-tenancy. Un nombre reservado choca con rutas de infraestructura
 * (`admin`, `api`) o con superficies de la plataforma (`platform`, `billing`), no
 * con la forma del JSON. `@repo/validation` no deberia saber que `shop` es
 * intocable; `@repo/commerce` es donde vive el dominio de tenant.
 */

/**
 * Los 16 reservados de D8.
 *
 * El `Set` se deriva del array en vez de escribirse a mano. Dos listas que se
 * pueden desincronizar son el item 61 de nuevo: el control acompana, no
 * verifica.
 */
export const RESERVED_SLUGS = [
  'www',
  'api',
  'admin',
  'app',
  'platform',
  'checkout',
  'billing',
  'support',
  'help',
  'docs',
  'assets',
  'static',
  'mail',
  'cdn',
  'shop',
  'store',
] as const

export type ReservedSlug = (typeof RESERVED_SLUGS)[number]

const RESERVED_SLUG_SET: ReadonlySet<string> = new Set(RESERVED_SLUGS)

/** Motivo del rechazo. `null` es el unico valor que significa "valido". */
export type SlugRejection =
  'empty' | 'invalid_format' | 'too_short' | 'too_long' | 'reserved'

export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 30

/**
 * Solo `[a-z0-9]` separados por guiones simples, sin guiones al principio, al
 * final ni dobles. El subdominio se arma como `<slug>.<host>`, asi que un guion
 * inicial o final produce un host que los resolvers rechazan o que los browsers
 * normalizan a algo distinto.
 *
 * Deliberadamente NO acepta guiones bajos ni mayusculas: se comparan contra
 * `tenants.slug` en un lookup exacto, y un slug que solo funciona en minúsculas
 * es un slug que se rompe en el primer copy-paste.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Valida un slug. **No normaliza ni muta la entrada.**
 *
 * Normalizar aca (bajar a minusculas, quitar diacriticos) seria aceptar en
 * silencio algo que el usuario escribio distinto de lo que queda: `"Mi Tienda"`
 * se volveria `"mi-tienda"` y el usuario nunca veria que su slug era invalido.
 * Peor: `"Admin"` y `"admin"` colisionarian en el set de reservados, que es lo
 * correcto, pero `"Mi Tienda"` y `"mitienda"` serian **tenants distintos** para
 * el usuario y el mismo slug en la DB si normalizáramos al final.
 *
 * Rechaza y muestra el valor recibido: el que decide si normalizar es el
 * producto, no una funcion de validacion.
 *
 * El orden de los chequeos es deliberado y esta escrito en el codigo porque
 * importa: formato primero, para que un string con caracteres raros no llegue
 * nunca a la comparacion contra el set.
 */
export function validateSlug(slug: string): SlugRejection | null {
  if (slug.length === 0) return 'empty'
  if (!SLUG_PATTERN.test(slug)) return 'invalid_format'
  if (slug.length < SLUG_MIN_LENGTH) return 'too_short'
  if (slug.length > SLUG_MAX_LENGTH) return 'too_long'
  if (RESERVED_SLUG_SET.has(slug)) return 'reserved'
  return null
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug)
}

/** Mensaje en espanol para cada rechazo. Reutilizado por el endpoint y la UI. */
export function slugRejectionMessage(rejection: SlugRejection): string {
  switch (rejection) {
    case 'empty':
      return 'El slug no puede estar vacío'
    case 'invalid_format':
      return 'El slug solo puede tener letras minúsculas, números y guiones'
    case 'too_short':
      return `El slug debe tener al menos ${SLUG_MIN_LENGTH} caracteres`
    case 'too_long':
      return `El slug no puede superar ${SLUG_MAX_LENGTH} caracteres`
    case 'reserved':
      return 'Ese nombre está reservado'
  }
}

/**
 * D8: **el slug nunca se reutiliza.** Cuando un tenant cancela, su slug queda
 * tomado para siempre.
 *
 * No hay codigo que lo impida, y no lo hay a proposito: `tenants.slug` es
 * `UNIQUE` y nadie borra filas de `tenants`. Si algun dia se agrega un "eliminar
 * tenant", esta regla deja de ser automatica y hay que ponerla donde el borrado
 * no pueda saltarla (un trigger o un `ON DELETE` restrictivo), porque en JS no
 * alcanza: el borrado y el alta son caminos distintos y ninguno mira al otro.
 */

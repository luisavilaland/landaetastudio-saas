// Cart
export type { CartItem, Cart, EnrichedCartItem } from './cart'
export { getCart, removeFromCart } from './cart'

// Products
export type {
  ProductImage,
  ProductVariant,
  ProductWithVariants,
} from './products'
export { getProducts, getProductBySlug } from './products'

// Email
export { sendOrderConfirmationEmail, sendWelcomeEmail } from './email'

// Categories
export type { CategoryData } from './categories'
export { getCategoriesForTenant } from './categories'

// Tenant
export { getTenantId } from './tenant'

// Webhook
export { makeSignature, verifyMercadoPagoSignature } from './webhook-signature'

// Encryption
export { encryptToken, decryptToken, EncryptionError } from './encryption'

// Rate limit y demas: solo los wrappers fail-open de abajo.
// El cliente crudo NO se reexporta: AGENTS.md prohibe usar `redisClient.*`
// directamente (el primer comando de un cold-start serverless se rechaza
// mientras el socket conecta). Exportarlo desde el barrel invita a violarlo.
export { safeGet, redisSetEx, redisDel, redisIncr, redisPexpire } from './redis'

// Suscripciones — Fase 2
export type {
  SubscriptionPermissions,
  SubscriptionStatus,
  PanelAccess,
} from './subscription-permissions'
export { derivePermissions } from './subscription-permissions'

// Item 61 (H-T6-1): transicion de suscripcion con el filtro por tenant
// garantizado por construccion. Vive en commerce (y no en @repo/db) porque
// `SubscriptionStatus` es de dominio y `@repo/db` no depende de nada interno:
// importarlo desde alla seria una dependencia circular.
export type {
  SubscriptionTransitionPatch,
  SubscriptionTransitionResult,
} from './subscription-transition'
export { transitionSubscription } from './subscription-transition'

// Tenant lifecycle
//
// Hoja propia y no una variante de `transitionSubscription`: la regla del
// diseno del item 61 (§9) es que una transicion que necesita otra forma se
// agrega como funcion nueva, no como flag. Un flag devuelve el filtro a ser
// codigo escrito a mano.
export type {
  TenantActivationPatch,
  TenantActivationResult,
} from './tenant-lifecycle'
export { activateTenant } from './tenant-lifecycle'

export type {
  ProrationInput,
  ProrationResult,
  ProrationDirection,
} from './subscription-proration'
export { calculateProration } from './subscription-proration'

export type { MpTopic } from './mp-webhook-events'
export { classifyMpEvent } from './mp-webhook-events'

export type { MercadoPagoApiError } from './mp-subscriptions'
export {
  createPreapproval,
  updatePreapproval,
  getPreapproval,
  getAuthorizedPayment,
  getPayment,
  MP_API,
} from './mp-subscriptions'

// Conversion centavos <-> unidad de moneda (item 48)
export { toMpAmount, fromMpAmount } from './mp-amounts'

// S3 / T8 / D8: reserva y validacion de slugs de tenant
export {
  RESERVED_SLUGS,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  validateSlug,
  isReservedSlug,
  slugRejectionMessage,
} from './tenant-slug'
export type { SlugRejection, ReservedSlug } from './tenant-slug'

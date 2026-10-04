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
  MP_API,
} from './mp-subscriptions'

// Conversion centavos <-> unidad de moneda (item 48)
export { toMpAmount, fromMpAmount } from './mp-amounts'

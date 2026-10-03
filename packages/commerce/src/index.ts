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

// Redis (export for testing or direct access if needed)
export { redisClient } from './redis'

// Rate limit (fail-open wrappers, AGENTS.md: nunca 500 si Redis cae)
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
  getAuthorizedPayment,
  MP_API,
} from './mp-subscriptions'

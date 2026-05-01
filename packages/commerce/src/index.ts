// Cart
export type { CartItem, Cart, EnrichedCartItem } from "./cart";
export { getCart, removeFromCart } from "./cart";

// Products
export type { ProductImage, ProductVariant, ProductWithVariants } from "./products";
export { getProducts, getProductBySlug } from "./products";

// Email
export { sendOrderConfirmationEmail } from "./email";

// Tenant
export { getTenantId } from "./tenant";

// Redis (export for testing or direct access if needed)
export { redisClient } from "./redis";

import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  status: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  price: z.number().int().min(1),
  stock: z.number().int().min(0),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  status: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  price: z.number().int().min(1).optional(),
  stock: z.number().int().min(0).optional(),
  removeImage: z.boolean().optional(),
});

export const variantSchema = z.object({
  sku: z.string().optional(),
  price: z.number().int().min(1),
  stock: z.number().int().min(0).default(0),
  options: z.record(z.string()).optional(),
});

export const variantsArraySchema = z.object({
  variants: z.array(variantSchema).min(1),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.string().min(1),
});

export const addCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1),
});

export const updateCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0),
});

export const deleteCartItemSchema = z.object({
  variantId: z.string().min(1),
  clearAll: z.boolean().optional(),
});

export const checkoutPreferenceSchema = z.object({
  orderId: z.string().min(1),
});

export const shippingDetailsSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
});

export const createCheckoutSchema = shippingDetailsSchema;

export const dashboardQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const createTenantSchema = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  plan: z.string().min(1),
  status: z.string().min(1),
});

export const updateTenantSchema = z.object({
  slug: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  plan: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(6),
});

export const webhookSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
  }),
});

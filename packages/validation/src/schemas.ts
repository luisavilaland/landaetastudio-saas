import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  status: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  price: z.number().int().min(1),
  stock: z.number().int().min(0),
})

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  status: z.string().min(1).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  sku: z.string().min(1).max(255).optional(),
  price: z.number().int().min(1).optional(),
  stock: z.number().int().min(0).optional(),
  removeImage: z.boolean().optional(),
})

export const variantSchema = z.object({
  sku: z.string().optional(),
  price: z.number().int().min(1),
  stock: z.number().int().min(0).default(0),
  options: z.record(z.string(), z.string()).optional(),
})

export const variantsArraySchema = z.object({
  variants: z.array(variantSchema).min(1),
})

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
})

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
})

export const updateOrderStatusSchema = z.object({
  status: z.string().min(1),
})

export const addCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1),
})

export const updateCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0),
})

export const deleteCartItemSchema = z
  .object({
    variantId: z.string().min(1).optional(),
    clearAll: z.boolean().optional(),
  })
  .refine((data) => data.clearAll === true || data.variantId !== undefined, {
    message: 'Must provide variantId when not clearing all',
    path: ['variantId'],
  })

export const checkoutPreferenceSchema = z.object({
  orderId: z.string().min(1),
  customerEmail: z.string().email('Email inválido'),
})

export const shippingDetailsSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  shippingMethodId: z.string().min(1).optional(),
})

export const createCheckoutSchema = shippingDetailsSchema

export const dashboardQuerySchema = z.object({
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
})

export const customDomainSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (val === undefined || val === null || val.trim() === '') return undefined
    return val.trim()
  })
  .refine(
    (val) =>
      !val || /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(val),
    {
      message:
        'Dominio inválido. Usa formato ej. mitienda.com (sin http:// ni paths)',
    },
  )

/**
 * Valores admitidos en `tenants.status`.
 *
 * Tiene que coincidir con el enum `tenants_status` de la base. Si diverge, el
 * endpoint acepta un valor que la DB rechaza.
 */
export const tenantStatusValues = [
  'pending',
  'active',
  'suspended',
  'cancelled',
] as const

export const tenantStatusSchema = z.enum(tenantStatusValues)

export const createTenantSchema = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  plan: z.string().min(1),
  // `z.enum` y no `z.string()` porque la columna paso a `pgEnum` (T2).
  //
  // Con `text`, un status invalido se guardaba y nadie lo notaba: nada leia la
  // columna. Con `pgEnum`, la DB lanza `invalid input value for enum
  // tenants_status` y el endpoint responde **500** en vez de **400** - y es el
  // endpoint que el superadmin usa para editar tenants.
  //
  // Es el mismo patron del item 67: validar antes de escribir convierte un
  // error de infraestructura en uno de peticion.
  //
  // Sigue siendo **obligatorio**, igual que antes del cambio: hacer opcional
  // seria relajar el contrato de la API de paso, y ese no es el PR que decide
  // eso.
  status: tenantStatusSchema,
  customDomain: customDomainSchema.optional(),
})

export const updateTenantSchema = z.object({
  slug: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  plan: z.string().min(1).optional(),
  status: tenantStatusSchema.optional(),
  customDomain: customDomainSchema.optional(),
})

export const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(6),
})

// S3 / D3, D6: alta publica de tenant. A diferencia de `registerSchema` (que
// registra un COMPRADOR dentro de una tienda existente), este crea el tenant.
//
// `status` NO es un campo del request: el backend lo fuerza a `pending` (D2 - el
// subdominio no resuelve hasta que el pago lo activa). Aceptarlo del cliente
// seria darle al comprador el control de si su tienda sale al mundo.
//
// Lo mismo con `customDomain`: es D16 y no entra en este slice.
//
// `min(8)` en password contra el `min(6)` de `registerSchema`: un tenant admin
// tiene mas superficie que un comprador (catalogo, configuracion, MP). Los dos
// floors conviven y no es una contradiccion - son superficies distintas.
export const registerTenantSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  // El formato y los reservados los valida `validateSlug` de
  // `@repo/commerce`, que es donde vive la regla de negocio de D8. Acá solo
  // el largo, para no rechazar por longitud antes de haber evaluado el slug.
  slug: z.string().min(3).max(30),
  planId: z.string().uuid(),
})

export const webhookSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
  }),
})

export const productImageSchema = z.object({
  alt: z.string().optional(),
  position: z.number().int().min(0).default(0),
})

export const createShippingMethodSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0),
  freeShippingThreshold: z.number().int().min(0).nullable().optional(),
  estimatedDaysMin: z.number().int().min(0).nullable().optional(),
  estimatedDaysMax: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

export const updateShippingMethodSchema = createShippingMethodSchema.partial()

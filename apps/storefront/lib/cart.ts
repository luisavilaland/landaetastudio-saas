import { db, dbProducts, dbProductVariants, dbProductImages } from "@repo/db";
import { eq, inArray } from "drizzle-orm";
import { redisClient } from "./redis";

export type CartItem = {
  variantId: string;
  quantity: number;
  addedAt: string;
};

export type Cart = {
  items: CartItem[];
  updatedAt: string;
};

export type EnrichedCartItem = CartItem & {
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    price: number;
    stock: number | null;
  } | null;
  variant?: {
    sku: string;
    options: Record<string, string>;
  };
};

export async function getCart(sessionId: string): Promise<EnrichedCartItem[]> {
  if (!sessionId) return [];

  const data = await redisClient.get(`cart:${sessionId}`);
  if (!data) return [];

  const cart = JSON.parse(data) as Cart;
  if (cart.items.length === 0) return [];

  const variantIds = cart.items.map((item) => item.variantId);

  if (variantIds.length === 0) return [];

  const variants = await db
    .select({
      variantId: dbProductVariants.id,
      variantPrice: dbProductVariants.price,
      variantStock: dbProductVariants.stock,
      variantSku: dbProductVariants.sku,
      variantOptions: dbProductVariants.options,
      productId: dbProducts.id,
      productName: dbProducts.name,
      productSlug: dbProducts.slug,
      productImage: dbProducts.imageUrl,
    })
    .from(dbProductVariants)
    .innerJoin(dbProducts, eq(dbProductVariants.productId, dbProducts.id))
    .where(inArray(dbProductVariants.id, variantIds));

  const variantMap = new Map(variants.map((v) => [v.variantId, v]));

  const productIds = variants.map((v) => v.productId);
  const images = productIds.length > 0
    ? await db
        .select({
          productId: dbProductImages.productId,
          url: dbProductImages.url,
        })
        .from(dbProductImages)
        .where(inArray(dbProductImages.productId, productIds))
        .orderBy(dbProductImages.position)
    : [];

  const firstImageByProduct = images.reduce((acc, img) => {
    if (!acc[img.productId]) acc[img.productId] = img.url;
    return acc;
  }, {} as Record<string, string>);

  const enrichedItems: EnrichedCartItem[] = [];

  for (const item of cart.items) {
    const variant = variantMap.get(item.variantId);
    if (!variant) continue;

    const firstImage = firstImageByProduct[variant.productId];

    enrichedItems.push({
      ...item,
      product: {
        id: variant.productId,
        name: variant.productName,
        slug: variant.productSlug,
        imageUrl: firstImage || variant.productImage,
        price: variant.variantPrice,
        stock: variant.variantStock,
      },
      variant: {
        sku: variant.variantSku,
        options: (variant.variantOptions as Record<string, string>) || {},
      },
    });
  }

  return enrichedItems;
}

export async function removeFromCart(
  sessionId: string,
  variantId: string
): Promise<EnrichedCartItem[]> {
  if (!sessionId) return [];

  const data = await redisClient.get(`cart:${sessionId}`);
  if (!data) return [];

  const cart = JSON.parse(data) as Cart;

  cart.items = cart.items.filter((item) => item.variantId !== variantId);

  if (cart.items.length === 0) {
    await redisClient.del(`cart:${sessionId}`);
    return [];
  }

  cart.updatedAt = new Date().toISOString();
  await redisClient.setex(`cart:${sessionId}`, 60 * 60 * 24 * 7, JSON.stringify(cart));

  return getCart(sessionId);
}
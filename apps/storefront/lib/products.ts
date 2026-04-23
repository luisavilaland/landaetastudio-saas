import { db, dbProducts, dbProductVariants } from "@repo/db";
import { eq, desc, and, isNotNull } from "drizzle-orm";

export type ProductWithVariant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  status: string | null;
  createdAt: Date;
  variant: {
    id: string;
    price: number;
    stock: number | null;
    sku: string;
  } | null;
};

export async function getProducts(
  tenantId: string,
  limit: number = 12
): Promise<ProductWithVariant[]> {
  const results = await db
    .select({
      id: dbProducts.id,
      name: dbProducts.name,
      slug: dbProducts.slug,
      description: dbProducts.description,
      imageUrl: dbProducts.imageUrl,
      status: dbProducts.status,
      createdAt: dbProducts.createdAt,
      variantId: dbProductVariants.id,
      variantPrice: dbProductVariants.price,
      variantStock: dbProductVariants.stock,
      variantSku: dbProductVariants.sku,
    })
    .from(dbProducts)
    .innerJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(and(eq(dbProducts.tenantId, tenantId), eq(dbProducts.status, "active")))
    .orderBy(desc(dbProducts.createdAt))
    .limit(limit);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    status: row.status,
    createdAt: row.createdAt,
    variant: {
      id: row.variantId,
      price: row.variantPrice,
      stock: row.variantStock,
      sku: row.variantSku,
    },
  }));
}

export async function getProductBySlug(
  tenantId: string,
  slug: string
): Promise<ProductWithVariant | null> {
  const results = await db
    .select({
      id: dbProducts.id,
      name: dbProducts.name,
      slug: dbProducts.slug,
      description: dbProducts.description,
      imageUrl: dbProducts.imageUrl,
      status: dbProducts.status,
      createdAt: dbProducts.createdAt,
      variantId: dbProductVariants.id,
      variantPrice: dbProductVariants.price,
      variantStock: dbProductVariants.stock,
      variantSku: dbProductVariants.sku,
    })
    .from(dbProducts)
    .innerJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(
      and(
        eq(dbProducts.tenantId, tenantId),
        eq(dbProducts.slug, slug),
        eq(dbProducts.status, "active")
      )
    )
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    status: row.status,
    createdAt: row.createdAt,
    variant: {
      id: row.variantId,
      price: row.variantPrice,
      stock: row.variantStock,
      sku: row.variantSku,
    },
  };
}
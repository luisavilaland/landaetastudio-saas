import { db, dbProducts, dbProductVariants, dbProductImages, dbCategories } from "@repo/db";
import { eq, desc, and, isNotNull, inArray } from "drizzle-orm";

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number | null;
};

export type ProductWithVariant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  status: string | null;
  createdAt: Date;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  variant: {
    id: string;
    price: number;
    stock: number | null;
    sku: string;
  } | null;
  images: ProductImage[];
};

export async function getProducts(
  tenantId: string,
  limit: number = 12,
  categorySlug?: string
): Promise<ProductWithVariant[]> {
  let categoryFilter = undefined;
  
  if (categorySlug) {
    const categoryResult = await db
      .select({ id: dbCategories.id })
      .from(dbCategories)
      .where(and(eq(dbCategories.tenantId, tenantId), eq(dbCategories.slug, categorySlug)))
      .limit(1);
    
    if (categoryResult.length > 0) {
      categoryFilter = categoryResult[0].id;
    } else {
      return [];
    }
  }

  const conditions = [
    eq(dbProducts.tenantId, tenantId),
    eq(dbProducts.status, "active"),
  ];

  if (categoryFilter) {
    conditions.push(eq(dbProducts.categoryId, categoryFilter));
  }

  const results = await db
    .select({
      id: dbProducts.id,
      name: dbProducts.name,
      slug: dbProducts.slug,
      description: dbProducts.description,
      imageUrl: dbProducts.imageUrl,
      status: dbProducts.status,
      createdAt: dbProducts.createdAt,
      categoryId: dbProducts.categoryId,
      categoryName: dbCategories.name,
      categorySlug: dbCategories.slug,
      variantId: dbProductVariants.id,
      variantPrice: dbProductVariants.price,
      variantStock: dbProductVariants.stock,
      variantSku: dbProductVariants.sku,
    })
    .from(dbProducts)
    .innerJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .leftJoin(dbCategories, eq(dbProducts.categoryId, dbCategories.id))
    .where(and(...conditions))
    .orderBy(desc(dbProducts.createdAt))
    .limit(limit);

  const productIds = results.map((r) => r.id);

  const images = await db
    .select()
    .from(dbProductImages)
    .where(and(eq(dbProductImages.tenantId, tenantId), inArray(dbProductImages.productId, productIds)))
    .orderBy(dbProductImages.position);

  const imagesByProduct = images.reduce((acc, img) => {
    if (!acc[img.productId]) acc[img.productId] = [];
    acc[img.productId].push({
      id: img.id,
      url: img.url,
      alt: img.alt,
      position: img.position ?? 0,
    });
    return acc;
  }, {} as Record<string, ProductImage[]>);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    status: row.status,
    createdAt: row.createdAt,
    categoryId: row.categoryId,
    categoryName: row.categoryName ?? null,
    categorySlug: row.categorySlug ?? null,
    variant: {
      id: row.variantId,
      price: row.variantPrice,
      stock: row.variantStock,
      sku: row.variantSku,
    },
    images: imagesByProduct[row.id] || [],
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
      categoryId: dbProducts.categoryId,
      categoryName: dbCategories.name,
      categorySlug: dbCategories.slug,
      variantId: dbProductVariants.id,
      variantPrice: dbProductVariants.price,
      variantStock: dbProductVariants.stock,
      variantSku: dbProductVariants.sku,
    })
    .from(dbProducts)
    .innerJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .leftJoin(dbCategories, eq(dbProducts.categoryId, dbCategories.id))
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

  const images = await db
    .select()
    .from(dbProductImages)
    .where(eq(dbProductImages.productId, row.id))
    .orderBy(dbProductImages.position);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    status: row.status,
    createdAt: row.createdAt,
    categoryId: row.categoryId,
    categoryName: row.categoryName ?? null,
    categorySlug: row.categorySlug ?? null,
    variant: {
      id: row.variantId,
      price: row.variantPrice,
      stock: row.variantStock,
      sku: row.variantSku,
    },
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      position: img.position ?? 0,
    })),
  };
}
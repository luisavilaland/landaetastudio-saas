import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants, dbProductImages, dbTenants } from "@repo/db";
import { getTenantId } from "@/lib/tenant";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const tenantSlug = request.headers.get("x-tenant-slug") || "default";
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
  const offset = parseInt(searchParams.get("offset") || "0");

  const tenantId = await getTenantId(tenantSlug);
  if (!tenantId) {
    return NextResponse.json({ products: [], total: 0 });
  }

  if (!query.trim()) {
    return NextResponse.json({ products: [], total: 0 });
  }

  const searchPattern = `%${query}%`;

  const whereConditions = and(
    eq(dbProducts.tenantId, tenantId),
    eq(dbProducts.status, "active"),
    or(
      ilike(dbProducts.name, searchPattern),
      ilike(dbProducts.description, searchPattern),
      ilike(dbProductVariants.sku, searchPattern)
    )
  );

  const productsQuery = db
    .select({
      id: dbProducts.id,
      name: dbProducts.name,
      slug: dbProducts.slug,
      description: dbProducts.description,
      imageUrl: dbProducts.imageUrl,
      status: dbProducts.status,
      createdAt: dbProducts.createdAt,
    })
    .from(dbProducts)
    .leftJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(whereConditions)
    .groupBy(dbProducts.id)
    .orderBy(desc(dbProducts.createdAt))
    .limit(limit)
    .offset(offset);

  const countQuery = db
    .select({ count: sql<number>`count(distinct ${dbProducts.id})` })
    .from(dbProducts)
    .leftJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(whereConditions);

  const [products, countResult] = await Promise.all([
    productsQuery,
    countQuery,
  ]);

  const total = countResult[0]?.count || 0;
  const productIds = products.map((p) => p.id);

  const variants = await db
    .select({
      id: dbProductVariants.id,
      productId: dbProductVariants.productId,
      price: dbProductVariants.price,
      stock: dbProductVariants.stock,
      sku: dbProductVariants.sku,
      options: dbProductVariants.options,
    })
    .from(dbProductVariants)
    .where(
      and(
        eq(dbProductVariants.tenantId, tenantId),
        sql`${dbProductVariants.productId} in ${productIds}`
      )
    );

  const images = await db
    .select({
      id: dbProductImages.id,
      productId: dbProductImages.productId,
      url: dbProductImages.url,
      alt: dbProductImages.alt,
      position: dbProductImages.position,
    })
    .from(dbProductImages)
    .where(
      and(
        eq(dbProductImages.tenantId, tenantId),
        sql`${dbProductImages.productId} in ${productIds}`
      )
    )
    .orderBy(dbProductImages.position);

  const variantsByProduct = variants.reduce((acc, v) => {
    if (!acc[v.productId]) acc[v.productId] = [];
    acc[v.productId].push({
      id: v.id,
      price: v.price,
      stock: v.stock,
      sku: v.sku,
      options: (v.options as Record<string, string>) || {},
    });
    return acc;
  }, {} as Record<string, any[]>);

  const imagesByProduct = images.reduce((acc, img) => {
    if (!acc[img.productId]) acc[img.productId] = [];
    acc[img.productId].push({
      id: img.id,
      url: img.url,
      alt: img.alt,
      position: img.position ?? 0,
    });
    return acc;
  }, {} as Record<string, any[]>);

  const productsWithDetails = products.map((row) => {
    const productVariants = variantsByProduct[row.id] || [];
    const productImages = imagesByProduct[row.id] || [];
    const prices = productVariants.map((v) => v.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      status: row.status,
      createdAt: row.createdAt,
      variants: productVariants,
      images: productImages,
      priceRange: minPrice !== null ? { min: minPrice, max: maxPrice } : null,
      firstImage: productImages.length > 0 ? productImages[0] : null,
    };
  });

  return NextResponse.json({
    products: productsWithDetails,
    total,
    limit,
    offset,
  });
}

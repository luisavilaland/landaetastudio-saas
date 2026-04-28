import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, dbProducts, dbProductVariants, dbProductImages, dbCategories } from "@repo/db";
import { eq, desc } from "drizzle-orm";
import { ProductsTable } from "./products-table";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const tenantId = session.user?.tenantId as string;

  // Single query with JOINs instead of N+1 queries
  const productsRaw = await db
    .select({
      id: dbProducts.id,
      name: dbProducts.name,
      slug: dbProducts.slug,
      description: dbProducts.description,
      imageUrl: dbProducts.imageUrl,
      status: dbProducts.status,
      createdAt: dbProducts.createdAt,
      categoryId: dbProducts.categoryId,
      variantId: dbProductVariants.id,
      variantSku: dbProductVariants.sku,
      variantPrice: dbProductVariants.price,
      variantStock: dbProductVariants.stock,
    })
    .from(dbProducts)
    .leftJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(eq(dbProducts.tenantId, tenantId))
    .orderBy(desc(dbProducts.createdAt));

  // Get unique category IDs
  const categoryIds = [...new Set(productsRaw.map(p => p.categoryId).filter(Boolean))];
  const categoriesMap = new Map();
  if (categoryIds.length > 0) {
    const categories = await db
      .select({ id: dbCategories.id, name: dbCategories.name })
      .from(dbCategories)
      .where(eq(dbCategories.tenantId, tenantId));
    for (const cat of categories) {
      categoriesMap.set(cat.id, cat.name);
    }
  }

  // Get product IDs for images
  const productIds = [...new Set(productsRaw.map(p => p.id))];
  const images = await db
    .select()
    .from(dbProductImages)
    .where(eq(dbProductImages.tenantId, tenantId))
    .orderBy(dbProductImages.position);

  const imagesByProduct = images.reduce((acc, img) => {
    if (!acc[img.productId]) acc[img.productId] = [];
    acc[img.productId].push(img);
    return acc;
  }, {} as Record<string, typeof images>);

  // Group by product ID and nest variant
  const productMap = new Map();
  for (const row of productsRaw) {
    if (!productMap.has(row.id)) {
      productMap.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        imageUrl: row.imageUrl,
        description: row.description,
        status: row.status,
        createdAt: row.createdAt,
        categoryName: row.categoryId ? categoriesMap.get(row.categoryId) || null : null,
        variant: undefined,
        images: imagesByProduct[row.id] || [],
      });
    }
    if (row.variantId) {
      (productMap.get(row.id) as any).variant = {
        id: row.variantId,
        sku: row.variantSku || "",
        price: row.variantPrice || 0,
        stock: row.variantStock || 0,
        options: {},
      };
    }
  }

  const productsWithVariants = Array.from(productMap.values());

  return <ProductsTable initialProducts={productsWithVariants} />;
}
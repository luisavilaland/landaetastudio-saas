import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, dbProducts, dbProductVariants } from "@repo/db";
import { eq, desc } from "drizzle-orm";
import { ProductsTable } from "./products-table";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const tenantId = session.user?.tenantId as string;

  // Single query with JOIN instead of N+1 queries
  const productsRaw = await db
    .select({
      id: dbProducts.id,
      name: dbProducts.name,
      slug: dbProducts.slug,
      description: dbProducts.description,
      imageUrl: dbProducts.imageUrl,
      status: dbProducts.status,
      createdAt: dbProducts.createdAt,
      updatedAt: dbProducts.updatedAt,
      variantId: dbProductVariants.id,
      variantSku: dbProductVariants.sku,
      variantPrice: dbProductVariants.price,
      variantStock: dbProductVariants.stock,
    })
    .from(dbProducts)
    .leftJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(eq(dbProducts.tenantId, tenantId))
    .orderBy(desc(dbProducts.createdAt));

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
        variant: undefined,
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
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

  const products = await db
    .select()
    .from(dbProducts)
    .where(eq(dbProducts.tenantId, tenantId))
    .orderBy(desc(dbProducts.createdAt));

  const productsWithVariants = await Promise.all(
    products.map(async (product) => {
      const variants = await db
        .select()
        .from(dbProductVariants)
        .where(eq(dbProductVariants.productId, product.id))
        .limit(1);

      return {
        ...product,
        variant: variants[0] || null,
      };
    })
  );

  return <ProductsTable initialProducts={productsWithVariants} />;
}
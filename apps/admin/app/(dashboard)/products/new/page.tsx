import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { withTenantContext, dbCategories } from "@repo/db";
import { eq } from "drizzle-orm";
import { ProductForm } from "@/components/product-form";

export default async function NewProductPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const tenantId = session.user?.tenantId as string;

  const categories = await withTenantContext(tenantId, async (tx) =>
    tx
      .select()
      .from(dbCategories)
      .where(eq(dbCategories.tenantId, tenantId))
      .orderBy(dbCategories.name)
  );

  return <ProductForm categories={categories} mode="create" />;
}
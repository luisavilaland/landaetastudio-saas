import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, dbProducts, dbProductVariants } from "@repo/db";
import { eq } from "drizzle-orm";
import { ProductForm } from "@/components/product-form";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: Props) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const tenantId = session.user?.tenantId as string;

  const product = await db
    .select()
    .from(dbProducts)
    .where(eq(dbProducts.id, id))
    .limit(1);

  if (product.length === 0 || product[0].tenantId !== tenantId) {
    notFound();
  }

  const variant = await db
    .select()
    .from(dbProductVariants)
    .where(eq(dbProductVariants.productId, id))
    .limit(1);

  const initialProduct = {
    id: product[0].id,
    name: product[0].name,
    slug: product[0].slug,
    description: product[0].description,
    status: product[0].status,
    variant: variant[0] || null,
  };

  return <ProductForm initialProduct={initialProduct} mode="edit" />;
}
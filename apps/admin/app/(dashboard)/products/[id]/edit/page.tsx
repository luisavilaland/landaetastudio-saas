import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { withTenantContext, dbProducts, dbProductVariants, dbProductImages, dbCategories } from "@repo/db";
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

  const data = await withTenantContext(tenantId, async (tx) => {
    const product = await tx
      .select()
      .from(dbProducts)
      .where(eq(dbProducts.id, id))
      .limit(1);

    if (product.length === 0 || product[0].tenantId !== tenantId) {
      return null;
    }

    const variants = await tx
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, id))
      .orderBy(dbProductVariants.createdAt);

    const images = await tx
      .select()
      .from(dbProductImages)
      .where(eq(dbProductImages.productId, id))
      .orderBy(dbProductImages.position);

    const categories = await tx
      .select()
      .from(dbCategories)
      .where(eq(dbCategories.tenantId, tenantId))
      .orderBy(dbCategories.name);

    return { product: product[0], variants, images, categories };
  });

  if (!data) {
    notFound();
  }

  const { product, variants, images, categories } = data;
  const firstVariant = variants[0] || null;
    const initialProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status ?? "draft",
      categoryId: product.categoryId,
      images: images,
      variant: firstVariant ? {
        price: firstVariant.price,
        stock: firstVariant.stock ?? 0,
      } : null,
      variants: variants.map(v => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        stock: v.stock ?? 0,
        options: v.options as Record<string, string> || {},
      })),
    };

   return <ProductForm initialProduct={initialProduct} categories={categories} mode="edit" />;
}
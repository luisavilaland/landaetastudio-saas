import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants, dbProductImages, dbCategories } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { uploadImage } from "@repo/storage";
import { createProductSchema } from "@repo/validation";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user?.tenantId as string;

  const products = await db
    .select()
    .from(dbProducts)
    .where(eq(dbProducts.tenantId, tenantId));

  const productIds = products.map((p) => p.id);

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

  const productsWithImages = products.map((product) => ({
    ...product,
    images: imagesByProduct[product.id] || [],
  }));

  return NextResponse.json({ products: productsWithImages });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const description = (formData.get("description") as string) || null;
    const status = (formData.get("status") as string) || "draft";
    const categoryId = (formData.get("categoryId") as string) || null;
    const price = parseInt(formData.get("price") as string, 10);
    const stock = parseInt(formData.get("stock") as string, 10);
    const image = formData.get("image") as File | null;

    const validation = createProductSchema.safeParse({
      name,
      slug,
      description,
      status,
      categoryId: categoryId || undefined,
      price,
      stock,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { price: validPrice, stock: validStock } = validation.data;

    if (categoryId) {
      const category = await db
        .select()
        .from(dbCategories)
        .where(eq(dbCategories.id, categoryId))
        .limit(1);
      if (category.length === 0 || category[0].tenantId !== tenantId) {
        return NextResponse.json(
          { error: "Invalid category" },
          { status: 400 }
        );
      }
    }

    const existingSlug = await db
      .select()
      .from(dbProducts)
      .where(
        and(
          eq(dbProducts.slug, slug),
          eq(dbProducts.tenantId, tenantId)
        )
      )
      .limit(1);

    if (existingSlug.length > 0) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }

    const now = new Date();

    let imageUrl: string | null = null;

    if (image && image.size > 0) {
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.split(".").pop() || "png";
      imageUrl = await uploadImage(buffer, `products/${Date.now()}-${slug}.${ext}`, image.type);
    }

    const newProduct = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(dbProducts)
        .values({
          tenantId,
          name,
          slug,
          description,
          imageUrl,
          status,
          categoryId: categoryId || null,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const sku = slug.replace(/\s+/g, "-").toLowerCase();

      await tx
        .insert(dbProductVariants)
        .values({
          tenantId,
          productId: product.id,
          sku,
          price: validPrice,
          stock: validStock,
          options: {},
          createdAt: now,
          updatedAt: now,
        });

      return product;
    });

    const variants = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, newProduct.id));

    return NextResponse.json(
      { product: { ...newProduct, variants } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
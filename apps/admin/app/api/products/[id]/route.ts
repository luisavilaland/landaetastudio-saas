import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants, dbProductImages, dbOrderItems, dbCategories } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";
import { uploadImage, deleteImage } from "@repo/storage";
import { updateProductSchema } from "@repo/validation";

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const product = await db
      .select()
      .from(dbProducts)
      .where(eq(dbProducts.id, id))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product[0].tenantId !== tenantId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const variant = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, id))
      .limit(1);

    const images = await db
      .select()
      .from(dbProductImages)
      .where(eq(dbProductImages.productId, id))
      .orderBy(dbProductImages.position);

    return NextResponse.json({
      ...product[0],
      variant: variant[0] || null,
      images,
    });
  } catch (error) {
    console.error("Error getting product:", error);
    return NextResponse.json({ error: "Failed to get product" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const product = await db
      .select()
      .from(dbProducts)
      .where(eq(dbProducts.id, id))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product[0].tenantId !== tenantId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.formData();
    const contentType = request.headers.get("content-type") || "";

    let name: string | undefined;
    let slug: string | undefined;
    let description: string | null | undefined;
    let status: string | null | undefined;
    let categoryId: string | null | undefined;
    let price: number | undefined;
    let stock: number | undefined;
    let image: File | null | undefined;
    let removeImage: boolean | undefined;

    if (contentType.includes("application/json")) {
      const json = await request.json();
      name = json.name;
      slug = json.slug;
      description = json.description ?? null;
      status = json.status ?? null;
      categoryId = json.categoryId ?? null;
      price = json.price ? parseInt(json.price, 10) : undefined;
      stock = json.stock !== undefined ? parseInt(json.stock, 10) : undefined;
    } else {
      name = body.get("name") as string;
      slug = body.get("slug") as string;
      description = (body.get("description") as string) || null;
      status = (body.get("status") as string) || null;
      categoryId = (body.get("categoryId") as string) || null;
      price = parseInt(body.get("price") as string, 10);
      stock = parseInt(body.get("stock") as string, 10);
      image = body.get("image") as File | null;
      removeImage = body.get("removeImage") === "true";
    }

    const validation = updateProductSchema.safeParse({
      name,
      slug,
      description,
      status,
      categoryId: categoryId ?? undefined,
      price,
      stock,
      removeImage,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { price: validPrice, stock: validStock } = validation.data;

    if (categoryId !== undefined && categoryId !== null) {
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

    if (slug && slug !== product[0].slug) {
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
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
    }

    const now = new Date();
    const safeSlug = slug ?? product[0].slug;
    const newSku = safeSlug.replace(/\s+/g, "-").toLowerCase();

    let imageUrl = product[0].imageUrl;

    if (image && image.size > 0) {
      if (product[0].imageUrl) {
        await deleteImage(product[0].imageUrl);
      }
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.split(".").pop() || "png";
      imageUrl = await uploadImage(buffer, `products/${Date.now()}-${slug}.${ext}`, image.type);
    } else if (removeImage && product[0].imageUrl) {
      await deleteImage(product[0].imageUrl);
      imageUrl = null;
    }

    const metadata = product[0].metadata;

    const updateProductFields: Record<string, unknown> = {
      updatedAt: now,
    };
    if (name) updateProductFields.name = name;
    if (slug) updateProductFields.slug = slug;
    if (description !== undefined) updateProductFields.description = description;
    if (status) updateProductFields.status = status;
    if (categoryId !== undefined) updateProductFields.categoryId = categoryId || null;
    if (metadata) updateProductFields.metadata = metadata;

    if (image || removeImage !== undefined) {
      if (image && image.size > 0) {
        if (product[0].imageUrl) {
          await deleteImage(product[0].imageUrl);
        }
        const buffer = Buffer.from(await image.arrayBuffer());
        const ext = image.name.split(".").pop() || "png";
imageUrl = await uploadImage(buffer, `products/${Date.now()}-${safeSlug}.${ext}`, image.type);
      } else if (removeImage && product[0].imageUrl) {
        await deleteImage(product[0].imageUrl);
        imageUrl = null;
      }
      updateProductFields.imageUrl = imageUrl;
    }

    const updateVariantFields: Record<string, unknown> = {
      updatedAt: now,
    };
    if (slug) updateVariantFields.sku = slug.replace(/\s+/g, "-").toLowerCase();
    if (validPrice !== undefined) updateVariantFields.price = validPrice;
    if (validStock !== undefined) updateVariantFields.stock = validStock;

    await db.transaction(async (tx) => {
      if (Object.keys(updateProductFields).length > 1) {
        await tx
          .update(dbProducts)
          .set(updateProductFields)
          .where(eq(dbProducts.id, id));
      }

      if (Object.keys(updateVariantFields).length > 1) {
        await tx
          .update(dbProductVariants)
          .set(updateVariantFields)
          .where(eq(dbProductVariants.productId, id));
      }
    });

    const updatedProduct = await db
      .select()
      .from(dbProducts)
      .where(eq(dbProducts.id, id))
      .limit(1);

    const variant = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, id))
      .limit(1);

    return NextResponse.json({
      ...updatedProduct[0],
      variant: variant[0] || null,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const product = await db
      .select()
      .from(dbProducts)
      .where(eq(dbProducts.id, id))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product[0].tenantId !== tenantId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check for associated order_items before delete
    const variants = await db
      .select({ id: dbProductVariants.id })
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, id));

    const variantIds = variants.map((v) => v.id);
    if (variantIds.length > 0) {
      const orderItems = await db
        .select()
        .from(dbOrderItems)
        .where(inArray(dbOrderItems.productVariantId, variantIds))
        .limit(1);

      if (orderItems.length > 0) {
        return NextResponse.json(
          { error: "Producto tiene órdenes asociadas" },
          { status: 409 }
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(dbProductVariants)
        .where(eq(dbProductVariants.productId, id));

      await tx
        .delete(dbProducts)
        .where(eq(dbProducts.id, id));
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
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
  let updateProductFields: Record<string, unknown> = {};
  let variantOperation: 'update' | 'insert' | 'none' = 'none';
  let variantFields: Record<string, unknown> = {};
  
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
      price = json.price !== undefined ? parseInt(json.price, 10) : undefined;
      stock = json.stock !== undefined ? parseInt(json.stock, 10) : undefined;
    } else {
      const body = await request.formData();
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
      status: status === null ? undefined : status,
      categoryId: categoryId ?? undefined,
      price,
      stock,
      removeImage,
    });

    if (!validation.success) {
      console.error("[PUT Product] Validation error:", validation.error.issues);
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

    let imageUrl = product[0].imageUrl;
    let newImageUrl = imageUrl;

    if (image && image.size > 0) {
      try {
        if (product[0].imageUrl) {
          await deleteImage(product[0].imageUrl);
        }
        const buffer = Buffer.from(await image.arrayBuffer());
        const ext = image.name.split(".").pop() || "png";
        newImageUrl = await uploadImage(buffer, `products/${Date.now()}-${safeSlug}.${ext}`, image.type);
      } catch (uploadError) {
        console.error("[PUT Product] Error uploading image:", uploadError);
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
      }
    } else if (removeImage && product[0].imageUrl) {
      try {
        await deleteImage(product[0].imageUrl);
        newImageUrl = null;
      } catch (deleteError) {
        console.error("[PUT Product] Error deleting image:", deleteError);
      }
    }

    const metadata = product[0].metadata;

    updateProductFields = {
      updatedAt: now,
    };
    if (name) updateProductFields.name = name;
    if (slug) updateProductFields.slug = slug;
    if (description !== undefined) updateProductFields.description = description;
    if (status) updateProductFields.status = status;
    if (categoryId !== undefined) updateProductFields.categoryId = categoryId || null;
    if (metadata) updateProductFields.metadata = metadata;
    if (newImageUrl !== imageUrl) updateProductFields.imageUrl = newImageUrl;

    // Get existing variant
    const existingVariant = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, id))
      .limit(1);

    // Determine if we need to update variant
    if (existingVariant.length > 0) {
      // Variant exists - UPDATE
      const currentVariant = existingVariant[0];
      variantFields = { updatedAt: now };

      // Handle SKU: only update if explicitly sent and different from current
      // The SKU should only change if frontend explicitly sends a different SKU
      // We don't automatically change SKU based on slug
      let skuFromBody = validation.data.sku || null;
      
      if (skuFromBody && skuFromBody !== currentVariant.sku) {
        const newSku = skuFromBody.replace(/\s+/g, "-").toLowerCase();
        console.log(`[PUT Product] SKU changing from ${currentVariant.sku} to ${newSku}`);
        
        // Check if new SKU already exists for this tenant (in another variant)
        const existingSku = await db
          .select()
          .from(dbProductVariants)
          .where(
            and(
              eq(dbProductVariants.sku, newSku),
              eq(dbProductVariants.tenantId, tenantId)
            )
          )
          .limit(1);

        if (existingSku.length > 0) {
          return NextResponse.json({ error: "El SKU ya existe en otra variante" }, { status: 409 });
        }

        variantFields.sku = newSku;
      } else if (skuFromBody && skuFromBody === currentVariant.sku) {
        console.log(`[PUT Product] SKU unchanged (${skuFromBody}), skipping SKU update`);
      } else {
        console.log(`[PUT Product] No SKU sent, keeping current: ${currentVariant.sku}`);
      }

      // Only add price/stock if they actually changed
      if (validPrice !== undefined && validPrice !== currentVariant.price) {
        variantFields.price = validPrice;
      }
      if (validStock !== undefined && validStock !== currentVariant.stock) {
        variantFields.stock = validStock;
      }

      // Only update if there are fields to update (besides updatedAt)
      if (Object.keys(variantFields).length > 1) {
        variantOperation = 'update';
      }
    } else {
      // No variant exists - INSERT (rare case)
      console.log(`[PUT Product] No variant found for product ${id}, creating new variant`);
      variantOperation = 'insert';
      
      const newSku = slug ? slug.replace(/\s+/g, "-").toLowerCase() : `product-${id}`;
      
      // Check SKU uniqueness for new variant
      const existingSku = await db
        .select()
        .from(dbProductVariants)
        .where(
          and(
            eq(dbProductVariants.sku, newSku),
            eq(dbProductVariants.tenantId, tenantId)
          )
        )
        .limit(1);

      if (existingSku.length > 0) {
        return NextResponse.json({ error: "El SKU ya existe" }, { status: 409 });
      }

      variantFields = {
        id: crypto.randomUUID(),
        productId: id,
        tenantId: tenantId,
        sku: newSku,
        price: validPrice || 0,
        stock: validStock || 0,
        createdAt: now,
        updatedAt: now,
      };
    }

    await db.transaction(async (tx) => {
      // Update product
      if (Object.keys(updateProductFields).length > 1) {
        console.log("[PUT Product] Updating product fields:", updateProductFields);
        await tx
          .update(dbProducts)
          .set(updateProductFields)
          .where(eq(dbProducts.id, id));
      }

      // Handle variant operation
      if (variantOperation === 'update') {
        console.log("[PUT Product] Updating variant with fields:", variantFields);
        await tx
          .update(dbProductVariants)
          .set(variantFields)
          .where(eq(dbProductVariants.productId, id));
      } else if (variantOperation === 'insert') {
        console.log("[PUT Product] Inserting new variant:", variantFields);
        await tx
          .insert(dbProductVariants)
          .values(variantFields as any);
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
    console.error("[PUT Product] Failed to update product:", error);
    console.error("[PUT Product] Update fields were:", { updateProductFields, variantFields, variantOperation });
    
    // Handle Postgres unique violation (duplicate SKU)
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: "El SKU ya existe en otra variante" }, { status: 409 });
    }
    
    return NextResponse.json({ error: "Failed to update product", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
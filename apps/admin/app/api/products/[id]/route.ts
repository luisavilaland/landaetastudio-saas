import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants, dbProductImages, dbOrderItems, dbCategories, withTenantContext } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";
import { uploadImage, deleteImage } from "@repo/storage";
import { updateProductSchema, normalizeSlug } from "@repo/validation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("admin-products-api");

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
      .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const variant = await db
      .select()
      .from(dbProductVariants)
      .where(and(eq(dbProductVariants.productId, id), eq(dbProductVariants.tenantId, tenantId)))
      .limit(1);

    const images = await db
      .select()
      .from(dbProductImages)
      .where(and(eq(dbProductImages.productId, id), eq(dbProductImages.tenantId, tenantId)))
      .orderBy(dbProductImages.position);

    return NextResponse.json({
      ...product[0],
      variant: variant[0] || null,
      images,
    });
  } catch (error) {
    logger.error({ error }, "Error getting product");
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 });
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
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const product = await db
      .select()
      .from(dbProducts)
      .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
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
      logger.warn({ issues: validation.error.issues }, "[PUT Product] Validation error");
      return NextResponse.json(
        { error: "Validación fallida", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { price: validPrice, stock: validStock } = validation.data;

    if (categoryId !== undefined && categoryId !== null) {
      const category = await db
        .select()
        .from(dbCategories)
        .where(and(eq(dbCategories.id, categoryId), eq(dbCategories.tenantId, tenantId)))
        .limit(1);
      if (category.length === 0) {
        return NextResponse.json(
          { error: "Categoría inválida" },
          { status: 400 }
        );
      }
    }

    const normalizedSlug = slug ? normalizeSlug(slug) : undefined;
    const slugChanged = normalizedSlug && normalizedSlug !== product[0].slug;
    
    if (slugChanged && normalizedSlug) {
      const existingSlug = await db
        .select()
        .from(dbProducts)
        .where(
          and(
            eq(dbProducts.slug, normalizedSlug),
            eq(dbProducts.tenantId, tenantId)
          )
        )
        .limit(1);
      
      if (existingSlug.length > 0) {
        return NextResponse.json({ error: "Ya existe un producto con ese slug", field: "slug" }, { status: 409 });
      }
    }

    const now = new Date();
    const safeSlug = normalizedSlug ?? product[0].slug;

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
        logger.error({ error: uploadError }, "[PUT Product] Error uploading image");
        return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
      }
    } else if (removeImage && product[0].imageUrl) {
      try {
        await deleteImage(product[0].imageUrl);
        newImageUrl = null;
      } catch (deleteError) {
        logger.error({ error: deleteError }, "[PUT Product] Error deleting image");
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

    // Get existing variants to check if SKU needs regeneration
    const existingVariants = await db
      .select()
      .from(dbProductVariants)
      .where(and(eq(dbProductVariants.productId, id), eq(dbProductVariants.tenantId, tenantId)));

    // If slug changed, regenerate SKU for all variants based on new slug
    if (slugChanged && existingVariants.length > 0) {
      const newSlug = normalizedSlug ?? product[0].slug;
      for (const variant of existingVariants) {
        const options = variant.options as Record<string, string> || {};
        const optionValues = Object.values(options);
        const newSku = `${newSlug}-${optionValues.join("-").toLowerCase()}`;

        // Check if new SKU already exists for this tenant (in another variant)
        if (newSku !== variant.sku) {
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
            return NextResponse.json(
              { error: `El SKU generado "${newSku}" ya existe en otra variante del mismo producto`, field: "sku" },
              { status: 409 }
            );
          }
        }
      }
    }

    // Determine if we need to update variant
    if (existingVariants.length > 0) {
      // Variant exists - UPDATE
      const currentVariant = existingVariants[0];
      variantFields = { updatedAt: now };

      // Handle SKU regeneration if slug changed
      if (slugChanged) {
        const newSlug = normalizedSlug ?? product[0].slug;
        const options = currentVariant.options as Record<string, string> || {};
        const optionValues = Object.values(options);
        const newSku = `${newSlug}-${optionValues.join("-").toLowerCase()}`;

        if (newSku !== currentVariant.sku) {
          variantFields.sku = newSku;
        }
      }

      // Handle SKU from body: only update if explicitly sent and different from current
      let skuFromBody = validation.data.sku || null;
      
      if (skuFromBody && skuFromBody !== currentVariant.sku) {
        const newSku = skuFromBody.replace(/\s+/g, "-").toLowerCase();
        logger.debug({ from: currentVariant.sku, to: newSku }, "[PUT Product] SKU changing");
        
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
          return NextResponse.json({ error: "El SKU ya existe en otra variante", field: "sku" }, { status: 409 });
        }

        variantFields.sku = newSku;
      } else if (skuFromBody && skuFromBody === currentVariant.sku) {
        logger.debug({ sku: skuFromBody }, "[PUT Product] SKU unchanged, skipping update");
      } else {
        logger.debug({ sku: currentVariant.sku }, "[PUT Product] No SKU sent, keeping current");
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
        logger.debug({ productId: id }, "[PUT Product] No variant found, creating new variant");
        variantOperation = 'insert';
        
        const baseSlug = normalizedSlug ?? product[0].slug;
        const newSku = baseSlug.replace(/\s+/g, "-").toLowerCase();
      
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
        return NextResponse.json({ error: "El SKU ya existe", field: "sku" }, { status: 409 });
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
        logger.debug({ fields: updateProductFields }, "[PUT Product] Updating product fields");
        await tx
          .update(dbProducts)
          .set(updateProductFields)
          .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)));
      }

      // Handle variant operations
      if (slugChanged && existingVariants.length > 0) {
        // Regenerate SKU for all variants when slug changes
        const newSlug = slug ?? product[0].slug;
        for (const variant of existingVariants) {
          const options = variant.options as Record<string, string> || {};
          const optionValues = Object.values(options);
          const newSku = `${newSlug}-${optionValues.join("-").toLowerCase()}`;

          if (newSku !== variant.sku) {
            await tx
              .update(dbProductVariants)
              .set({ sku: newSku, updatedAt: now })
              .where(and(eq(dbProductVariants.id, variant.id), eq(dbProductVariants.tenantId, tenantId)));
          }
        }
      } else if (variantOperation === 'update') {
        // Update single variant fields (price, stock, etc.)
        logger.debug({ fields: variantFields }, "[PUT Product] Updating variant");
        await tx
          .update(dbProductVariants)
          .set(variantFields)
          .where(and(eq(dbProductVariants.productId, id), eq(dbProductVariants.tenantId, tenantId)));
      } else if (variantOperation === 'insert') {
        logger.debug({ fields: variantFields }, "[PUT Product] Inserting new variant");
        await tx
          .insert(dbProductVariants)
          .values(variantFields as any);
      }
    });

    const updatedProduct = await db
      .select()
      .from(dbProducts)
      .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)))
      .limit(1);

    const variant = await db
      .select()
      .from(dbProductVariants)
      .where(and(eq(dbProductVariants.productId, id), eq(dbProductVariants.tenantId, tenantId)))
      .limit(1);

    return NextResponse.json({
      ...updatedProduct[0],
      variant: variant[0] || null,
    });
  } catch (error) {
    logger.error({ error, updateProductFields, variantFields, variantOperation }, "[PUT Product] Failed to update product");
    
    // Handle Postgres unique violation (duplicate SKU)
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: "El SKU ya existe en otra variante", field: "sku" }, { status: 409 });
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
      .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check for associated order_items before delete
    const variants = await db
      .select({ id: dbProductVariants.id })
      .from(dbProductVariants)
      .where(and(eq(dbProductVariants.productId, id), eq(dbProductVariants.tenantId, tenantId)));

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

    return withTenantContext(tenantId, async (tx) => {
      await tx
        .delete(dbProductVariants)
        .where(and(eq(dbProductVariants.productId, id), eq(dbProductVariants.tenantId, tenantId)));

      await tx
        .delete(dbProducts)
        .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)));

      return new NextResponse(null, { status: 204 });
    });
  } catch (error) {
    logger.error({ error }, "Error deleting product");
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
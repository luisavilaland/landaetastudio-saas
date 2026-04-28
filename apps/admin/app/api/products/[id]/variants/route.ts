import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants, dbOrderItems } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";
import { variantsArraySchema } from "@repo/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: productId } = await params;
    const tenantId = session.user?.tenantId as string;

    const product = await db
      .select({ tenantId: dbProducts.tenantId })
      .from(dbProducts)
      .where(eq(dbProducts.id, productId))
      .limit(1);

    if (product.length === 0 || product[0].tenantId !== tenantId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const variants = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, productId))
      .orderBy(dbProductVariants.createdAt);

    return NextResponse.json({ variants });
  } catch (error) {
    console.error("Error fetching variants:", error);
    return NextResponse.json(
      { error: "Failed to fetch variants" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: productId } = await params;
    const tenantId = session.user?.tenantId as string;

    const product = await db
      .select({ tenantId: dbProducts.tenantId, slug: dbProducts.slug })
      .from(dbProducts)
      .where(eq(dbProducts.id, productId))
      .limit(1);

    if (product.length === 0 || product[0].tenantId !== tenantId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = variantsArraySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { variants } = validation.data;

    const now = new Date();

    await db.transaction(async (tx) => {
      // Get existing variants
      const existingVariants = await tx
        .select()
        .from(dbProductVariants)
        .where(eq(dbProductVariants.productId, productId));

      // Check which variants have order_items (cannot be modified/deleted)
      const existingIds = existingVariants.map(v => v.id);
      
      if (existingIds.length > 0) {
        const orderItems = await tx
          .select({ variantId: dbOrderItems.productVariantId })
          .from(dbOrderItems)
          .where(inArray(dbOrderItems.productVariantId, existingIds))
          .groupBy(dbOrderItems.productVariantId);

        const variantsWithOrders = new Set(orderItems.map(o => o.variantId));

        // Update existing variants that don't have orders
        for (const v of variants) {
          const existingVariant = existingVariants.find(ev => 
            ev.sku === v.sku || 
            (v.options && JSON.stringify(ev.options) === JSON.stringify(v.options))
          );

          if (existingVariant) {
            // Update existing variant
            const updateData: Record<string, unknown> = { updatedAt: now };
            if (v.price !== undefined) updateData.price = Math.round(v.price);
            if (v.stock !== undefined) updateData.stock = Math.max(0, Math.round(v.stock || 0));
            if (v.options) updateData.options = v.options;

            await tx
              .update(dbProductVariants)
              .set(updateData)
              .where(eq(dbProductVariants.id, existingVariant.id));
          } else {
            // Insert new variant
            const options = v.options || {};
            const sku = v.sku || `${product[0].slug}-${Object.values(options).join("-").toLowerCase()}`;

            // Check SKU uniqueness
            const existingSku = await tx
              .select()
              .from(dbProductVariants)
              .where(
                and(
                  eq(dbProductVariants.sku, sku),
                  eq(dbProductVariants.tenantId, tenantId)
                )
              )
              .limit(1);

            if (existingSku.length > 0) {
              throw new Error(`SKU ${sku} ya existe`);
            }

            await tx
              .insert(dbProductVariants)
              .values({
                tenantId,
                productId,
                sku,
                price: Math.round(v.price),
                stock: Math.max(0, Math.round(v.stock || 0)),
                options,
                createdAt: now,
                updatedAt: now,
              });
          }
        }

        // Delete variants that are no longer in the list (only if they don't have orders)
        const newSkus = variants.map(v => v.sku).filter(Boolean);
        for (const ev of existingVariants) {
          if (!newSkus.includes(ev.sku) && !variantsWithOrders.has(ev.id)) {
            await tx
              .delete(dbProductVariants)
              .where(eq(dbProductVariants.id, ev.id));
          }
        }
      } else {
        // No existing variants or all have orders - just insert new ones
        const variantsToInsert = variants.map(
          (
            v: {
              sku?: string;
              price: number;
              stock: number;
              options?: Record<string, string>;
            },
            index: number
          ) => {
            const options = v.options || {};
            const sku =
              v.sku ||
              `${product[0].slug}-${Object.values(options)
                .join("-")
                .toLowerCase()}-${index}`;

            return {
              tenantId,
              productId,
              sku,
              price: Math.round(v.price),
              stock: Math.max(0, Math.round(v.stock || 0)),
              options,
              createdAt: now,
              updatedAt: now,
            };
          }
        );

        await tx.insert(dbProductVariants).values(variantsToInsert);
      }
    });

    const updatedVariants = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, productId))
      .orderBy(dbProductVariants.createdAt);

    return NextResponse.json({ variants: updatedVariants });
  } catch (error) {
    console.error("Error updating variants:", error);
    
    // Handle foreign key violation (variant has order_items)
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
      return NextResponse.json(
        { error: "No se puede eliminar la variante porque está asociada a pedidos existentes" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update variants" },
      { status: 500 }
    );
  }
}

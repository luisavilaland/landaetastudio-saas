import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
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
      await tx
        .delete(dbProductVariants)
        .where(eq(dbProductVariants.productId, productId));

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
    });

    const updatedVariants = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.productId, productId))
      .orderBy(dbProductVariants.createdAt);

    return NextResponse.json({ variants: updatedVariants });
  } catch (error) {
    console.error("Error updating variants:", error);
    return NextResponse.json(
      { error: "Failed to update variants" },
      { status: 500 }
    );
  }
}

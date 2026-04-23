import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

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

    return NextResponse.json({
      ...product[0],
      variant: variant[0] || null,
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

    const body = await request.json();
    const { name, slug, description, status, price, stock, metadata } = body;

    if (!name || !slug || price === undefined || stock === undefined) {
      return NextResponse.json(
        { error: "Name, slug, price and stock are required" },
        { status: 400 }
      );
    }

    if (slug !== product[0].slug) {
      const existingSlug = await db
        .select()
        .from(dbProducts)
        .where(eq(dbProducts.slug, slug))
        .limit(1);

      if (existingSlug.length > 0) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(dbProducts)
        .set({
          name,
          slug,
          description: description || product[0].description,
          status: status || product[0].status,
          metadata: metadata || product[0].metadata,
          updatedAt: now,
        })
        .where(eq(dbProducts.id, id));

      await tx
        .update(dbProductVariants)
        .set({
          price,
          stock,
          updatedAt: now,
        })
        .where(eq(dbProductVariants.productId, id));
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
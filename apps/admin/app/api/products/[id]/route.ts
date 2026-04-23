import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { uploadImage, deleteImage } from "@repo/storage";

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
    const { name, slug, description, status, price, stock, metadata, image } = body;

    if (!name || !slug || price === undefined || stock === undefined) {
      return NextResponse.json(
        { error: "Name, slug, price and stock are required" },
        { status: 400 }
      );
    }

    if (price <= 0) {
      return NextResponse.json(
        { error: "Price must be greater than 0" },
        { status: 400 }
      );
    }

    if (stock < 0) {
      return NextResponse.json(
        { error: "Stock cannot be negative" },
        { status: 400 }
      );
    }

    if (slug !== product[0].slug) {
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
    const newSku = slug.replace(/\s+/g, "-").toLowerCase();

    let imageUrl = product[0].imageUrl;

    if (image && image.startsWith("data:image")) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = image.match(/^data:image\/(\w+);base64,/)?.[1] || "png";
      imageUrl = await uploadImage(buffer, `${slug}.${ext}`, `image/${ext}`);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(dbProducts)
        .set({
          name,
          slug,
          description: description || product[0].description,
          imageUrl,
          status: status || product[0].status,
          metadata: metadata || product[0].metadata,
          updatedAt: now,
        })
        .where(eq(dbProducts.id, id));

      await tx
        .update(dbProductVariants)
        .set({
          sku: newSku,
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
import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { uploadImage } from "@repo/storage";

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

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;

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

    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = image.match(/^data:image\/(\w+);base64,/)?.[1] || "png";
      imageUrl = await uploadImage(buffer, `${slug}.${ext}`, `image/${ext}`);
    }

    const newProduct = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(dbProducts)
        .values({
          tenantId,
          name,
          slug,
          description: description || null,
          imageUrl,
          status: status || "draft",
          metadata: metadata || {},
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
          price,
          stock,
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
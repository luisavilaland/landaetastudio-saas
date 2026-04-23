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

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const description = (formData.get("description") as string) || null;
    const status = (formData.get("status") as string) || "draft";
    const price = parseInt(formData.get("price") as string, 10);
    const stock = parseInt(formData.get("stock") as string, 10);
    const image = formData.get("image") as File | null;

    if (!name || !slug || isNaN(price) || isNaN(stock)) {
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

    if (image && image.size > 0) {
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.split(".").pop() || "png";
      imageUrl = await uploadImage(buffer, `${slug}.${ext}`, image.type);
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
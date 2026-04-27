import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductImages } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { uploadImage } from "@repo/storage";

type Params = Promise<{ id: string }>;

export async function POST(
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

    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const alt = formData.get("alt") as string | null;
    const position = parseInt(formData.get("position") as string, 10) || 0;

    if (!image || image.size === 0) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const ext = image.name.split(".").pop() || "png";
    const fileName = `products/${id}/${Date.now()}-${image.name}`;

    const url = await uploadImage(buffer, fileName, image.type);

    const [imageRecord] = await db
      .insert(dbProductImages)
      .values({
        productId: id,
        tenantId,
        url,
        alt: alt || image.name,
        position,
      })
      .returning();

    return NextResponse.json(imageRecord, { status: 201 });
  } catch (error) {
    console.error("Error uploading product image:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

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

    const images = await db
      .select()
      .from(dbProductImages)
      .where(eq(dbProductImages.productId, id))
      .orderBy(dbProductImages.position);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error getting product images:", error);
    return NextResponse.json({ error: "Failed to get images" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductImages } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { deleteImage } from "@repo/storage";

type Params = Promise<{ id: string; imageId: string }>;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, imageId } = await params;
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

    const image = await db
      .select()
      .from(dbProductImages)
      .where(
        and(
          eq(dbProductImages.id, imageId),
          eq(dbProductImages.productId, id),
          eq(dbProductImages.tenantId, tenantId)
        )
      )
      .limit(1);

    if (image.length === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    await deleteImage(image[0].url);

    await db
      .delete(dbProductImages)
      .where(eq(dbProductImages.id, imageId));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting product image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db, dbProductImages } from "@repo/db";
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
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, imageId } = await params;
    const tenantId = session.user?.tenantId as string;

    const images = await db
      .select()
      .from(dbProductImages)
      .where(and(eq(dbProductImages.id, imageId), eq(dbProductImages.tenantId, tenantId)))
      .limit(1);

    if (images.length === 0) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const image = images[0];

    if (image.productId !== id) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const fileName = image.url.replace(/^.*\//, "");
    await deleteImage(`products/${id}/${fileName}`);

    await db
      .delete(dbProductImages)
      .where(and(eq(dbProductImages.id, imageId), eq(dbProductImages.tenantId, tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product image:", error);
      return NextResponse.json({ error: "Error al eliminar imagen" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { withTenantContext, dbProductImages } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { deleteImage } from "@repo/storage";
import { createLogger } from "@/lib/logger";

const logger = createLogger("admin-product-image-delete");

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

    const image = await withTenantContext(tenantId, async (tx) => {
      const [image] = await tx
        .select()
        .from(dbProductImages)
        .where(and(eq(dbProductImages.id, imageId), eq(dbProductImages.tenantId, tenantId)))
        .limit(1);
      return image ?? null;
    });

    if (!image) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    if (image.productId !== id) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const fileName = image.url.replace(/^.*\//, "");
    await deleteImage(`products/${id}/${fileName}`);

    await withTenantContext(tenantId, async (tx) => {
      await tx
        .delete(dbProductImages)
        .where(and(eq(dbProductImages.id, imageId), eq(dbProductImages.tenantId, tenantId)));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error deleting product image");
    return NextResponse.json({ error: "Error al eliminar imagen" }, { status: 500 });
  }
}

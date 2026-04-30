import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductImages } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { uploadImage } from "@repo/storage";
import { productImageSchema } from "@repo/validation";

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const product = await db
      .select()
      .from(dbProducts)
      .where(eq(dbProducts.id, id))
      .limit(1);

    if (product.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    if (product[0].tenantId !== tenantId) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const images = await db
      .select()
      .from(dbProductImages)
      .where(eq(dbProductImages.productId, id))
      .orderBy(dbProductImages.position);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error getting product images:", error);
      return NextResponse.json({ error: "Error al obtener imágenes" }, { status: 500 });
  }
}

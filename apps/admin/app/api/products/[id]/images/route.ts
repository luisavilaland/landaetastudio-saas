import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductImages } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { uploadImage } from "@repo/storage";
import { productImageSchema } from "@repo/validation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("admin-product-images-api");

type Params = Promise<{ id: string }>;

export async function GET(
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
    logger.error({ error }, "Error getting product images");
    return NextResponse.json({ error: "Error al obtener imágenes" }, { status: 500 });
  }
}

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

    const formData = await request.formData();
    const image = formData.get("image") as File | null;

    if (!image || image.size === 0) {
      return NextResponse.json({ error: "No se proporcionó imagen" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const ext = image.name.split(".").pop() || "png";
    const slug = product[0].slug;
    const imageUrl = await uploadImage(buffer, `products/${Date.now()}-${slug}.${ext}`, image.type);

    const now = new Date();

    const existingImages = await db
      .select()
      .from(dbProductImages)
      .where(eq(dbProductImages.productId, id))
      .orderBy(dbProductImages.position);

    const maxPosition = existingImages.length > 0
      ? Math.max(...existingImages.map(img => img.position ?? 0)) + 1
      : 0;

    const [newImage] = await db
      .insert(dbProductImages)
      .values({
        tenantId,
        productId: id,
        url: imageUrl,
        alt: product[0].name,
        position: maxPosition,
        createdAt: now,
      })
      .returning();

    return NextResponse.json({ image: newImage }, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Error uploading product image");
    return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
  }
}

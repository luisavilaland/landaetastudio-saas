import { NextRequest, NextResponse } from "next/server";
import { withTenantContext, dbProducts, dbProductImages } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { uploadImage } from "@repo/storage";
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

    return await withTenantContext(tenantId, async (tx) => {
      const product = await tx
        .select()
        .from(dbProducts)
        .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)))
        .limit(1);

      if (product.length === 0) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      const images = await tx
        .select()
        .from(dbProductImages)
        .where(and(eq(dbProductImages.productId, id), eq(dbProductImages.tenantId, tenantId)))
        .orderBy(dbProductImages.position);

      return NextResponse.json({ images });
    });
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

    const product = await withTenantContext(tenantId, async (tx) => {
      const [product] = await tx
        .select()
        .from(dbProducts)
        .where(and(eq(dbProducts.id, id), eq(dbProducts.tenantId, tenantId)))
        .limit(1);
      return product ?? null;
    });

    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const formData = await request.formData();
    const image = formData.get("image") as File | null;

    if (!image || image.size === 0) {
      return NextResponse.json({ error: "No se proporcionó imagen" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const ext = image.name.split(".").pop() || "png";
    const slug = product.slug;
    const imageUrl = await uploadImage(buffer, `products/${Date.now()}-${slug}.${ext}`, image.type);

    const now = new Date();

    const [newImage] = await withTenantContext(tenantId, async (tx) => {
      const existingImages = await tx
        .select()
        .from(dbProductImages)
        .where(and(eq(dbProductImages.productId, id), eq(dbProductImages.tenantId, tenantId)))
        .orderBy(dbProductImages.position);

      const maxPosition = existingImages.length > 0
        ? Math.max(...existingImages.map(img => img.position ?? 0)) + 1
        : 0;

      return await tx
        .insert(dbProductImages)
        .values({
          tenantId,
          productId: id,
          url: imageUrl,
          alt: product.name,
          position: maxPosition,
          createdAt: now,
        })
        .returning();
    });

    return NextResponse.json({ image: newImage }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 409 }
      );
    }
    logger.error({ error }, "Error uploading product image");
    return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, dbOrders, dbOrderItems, dbProductVariants, dbProducts } from "@repo/db";
import { eq, inArray } from "drizzle-orm";

const VALID_STATUSES = [
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "payment_failed",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
    }

    const [order] = await db
      .select()
      .from(dbOrders)
      .where(eq(dbOrders.id, id))
      .limit(1);

    if (!order || order.tenantId !== tenantId) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    const orderItems = await db
      .select({
        id: dbOrderItems.id,
        productVariantId: dbOrderItems.productVariantId,
        quantity: dbOrderItems.quantity,
        unitPrice: dbOrderItems.unitPrice,
      })
      .from(dbOrderItems)
      .where(eq(dbOrderItems.orderId, id));

    const variantIds = orderItems.map((item) => item.productVariantId);
    const variants = await db
      .select({
        id: dbProductVariants.id,
        productId: dbProductVariants.productId,
        sku: dbProductVariants.sku,
      })
      .from(dbProductVariants)
      .where(inArray(dbProductVariants.id, variantIds));

    const productIds = variants.map((v) => v.productId);
    const products = await db
      .select({
        id: dbProducts.id,
        name: dbProducts.name,
      })
      .from(dbProducts)
      .where(inArray(dbProducts.id, productIds));

    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const variantProductMap = new Map(variants.map((v) => [v.id, v.productId]));

    const itemsWithProduct = orderItems.map((item) => {
      const variantId = item.productVariantId;
      const productId = variantProductMap.get(variantId);
      const productName = productId ? productMap.get(productId) || "Producto" : "Producto";
      const sku = variants.find((v) => v.id === variantId)?.sku || "";

      return {
        id: item.id,
        productName,
        sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
    });

    return NextResponse.json({
      id: order.id,
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      total: order.total,
      status: order.status,
      shippingDetails: order.shippingDetails,
      items: itemsWithProduct,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    console.error("[Order GET] Error:", error);
    return NextResponse.json({ error: "Error al obtener orden" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status inválido. Debe ser uno de: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const [existingOrder] = await db
      .select({ id: dbOrders.id, tenantId: dbOrders.tenantId })
      .from(dbOrders)
      .where(eq(dbOrders.id, id))
      .limit(1);

    if (!existingOrder || existingOrder.tenantId !== tenantId) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    await db
      .update(dbOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(dbOrders.id, id));

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("[Order PUT] Error:", error);
    return NextResponse.json({ error: "Error al actualizar orden" }, { status: 500 });
  }
}
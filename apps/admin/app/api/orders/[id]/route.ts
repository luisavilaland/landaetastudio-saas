import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, dbOrders, dbOrderItems, dbProductVariants, dbProducts, withTenantContext } from "@repo/db";
import { eq, and, inArray } from "drizzle-orm";
import { updateOrderStatusSchema } from "@repo/validation";

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

    return withTenantContext(tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(dbOrders)
        .where(
          and(
            eq(dbOrders.id, id),
            eq(dbOrders.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!order) {
        return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
      }

      const orderItems = await tx
        .select({
          id: dbOrderItems.id,
          productVariantId: dbOrderItems.productVariantId,
          quantity: dbOrderItems.quantity,
          unitPrice: dbOrderItems.unitPrice,
        })
        .from(dbOrderItems)
        .where(
          and(
            eq(dbOrderItems.orderId, id),
            eq(dbOrderItems.tenantId, tenantId)
          )
        );

      const variantIds = orderItems.map((item) => item.productVariantId);
      const variants = await tx
        .select({
          id: dbProductVariants.id,
          productId: dbProductVariants.productId,
          sku: dbProductVariants.sku,
        })
        .from(dbProductVariants)
        .where(
          and(
            inArray(dbProductVariants.id, variantIds),
            eq(dbProductVariants.tenantId, tenantId)
          )
        );

      const productIds = variants.map((v) => v.productId);
      const products = await tx
        .select({
          id: dbProducts.id,
          name: dbProducts.name,
        })
        .from(dbProducts)
        .where(
          and(
            inArray(dbProducts.id, productIds),
            eq(dbProducts.tenantId, tenantId)
          )
        );

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
    const validation = updateOrderStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validación fallida", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { status } = validation.data;

    return withTenantContext(tenantId, async (tx) => {
      const [existingOrder] = await tx
        .select({ id: dbOrders.id })
        .from(dbOrders)
        .where(
          and(
            eq(dbOrders.id, id),
            eq(dbOrders.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingOrder) {
        return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
      }

      await tx
        .update(dbOrders)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(dbOrders.id, id),
            eq(dbOrders.tenantId, tenantId)
          )
        );

      return NextResponse.json({ success: true, status });
    });
  } catch (error) {
    console.error("[Order PUT] Error:", error);
    return NextResponse.json({ error: "Error al actualizar orden" }, { status: 500 });
  }
}
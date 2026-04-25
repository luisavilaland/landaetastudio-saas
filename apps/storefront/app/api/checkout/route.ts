import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redisClient } from "@/lib/redis";
import { db, dbOrders, dbOrderItems, dbProductVariants } from "@repo/db";
import { eq, inArray } from "drizzle-orm";

type CartItem = {
  variantId: string;
  quantity: number;
  addedAt: string;
};

type Cart = {
  items: CartItem[];
  updatedAt: string;
};

type ShippingDetails = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("cart_session_id")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Sesión de carrito no encontrada" },
        { status: 401 }
      );
    }

    const cartData = await redisClient.get(`cart:${sessionId}`);
    if (!cartData) {
      return NextResponse.json(
        { error: "Carrito vacío o no encontrado" },
        { status: 400 }
      );
    }

    const cart = JSON.parse(cartData) as Cart;
    if (!cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { error: "Carrito vacío" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, name, phone, address } = body as ShippingDetails;

    if (!email || !name || !phone || !address) {
      return NextResponse.json(
        { error: "Faltan datos de envío: email, name, phone, address son requeridos" },
        { status: 400 }
      );
    }

    const variantIds = cart.items.map((item) => item.variantId);
    const variants = await db
      .select({
        id: dbProductVariants.id,
        stock: dbProductVariants.stock,
        price: dbProductVariants.price,
        tenantId: dbProductVariants.tenantId,
      })
      .from(dbProductVariants)
      .where(inArray(dbProductVariants.id, variantIds));

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const outOfStock: string[] = [];
    for (const item of cart.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant || (variant.stock ?? 0) < item.quantity) {
        outOfStock.push(item.variantId);
      }
    }

    if (outOfStock.length > 0) {
      return NextResponse.json(
        { error: "Stock insuficiente", outOfStock },
        { status: 422 }
      );
    }

    const tenantId = variants[0]?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No se pudo determinar el tenant" },
        { status: 400 }
      );
    }

    const shippingDetails: ShippingDetails = { name, email, phone, address };

    const [order] = await db.transaction(async (tx) => {
      for (const item of cart.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) continue;

        await tx
          .update(dbProductVariants)
          .set({
            stock: (variant.stock ?? 0) - item.quantity,
          })
          .where(eq(dbProductVariants.id, item.variantId));
      }

      const [newOrder] = await tx
        .insert(dbOrders)
        .values({
          tenantId,
          status: "pending_payment",
          total: 0,
          currency: "UYU",
          customerEmail: email,
          shippingDetails,
        })
        .returning();

      for (const item of cart.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) continue;

        await tx.insert(dbOrderItems).values({
          orderId: newOrder.id,
          productVariantId: item.variantId,
          quantity: item.quantity,
          unitPrice: variant.price,
        });
      }

      return [newOrder];
    });

    let total = 0;
    for (const item of cart.items) {
      const variant = variantMap.get(item.variantId);
      if (variant) {
        total += variant.price * item.quantity;
      }
    }

    await db
      .update(dbOrders)
      .set({ total })
      .where(eq(dbOrders.id, order.id));

    await redisClient.del(`cart:${sessionId}`);

    return NextResponse.json({
      orderId: order.id,
      total,
      status: "pending_payment",
    });
  } catch (error) {
    console.error("[Checkout API] Error:", error);
    return NextResponse.json(
      { error: "Error al procesar la orden" },
      { status: 500 }
    );
  }
}
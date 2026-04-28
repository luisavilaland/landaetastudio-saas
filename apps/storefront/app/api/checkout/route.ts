import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { redisClient } from "@/lib/redis";
import { getTenantId } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { db, dbOrders, dbOrderItems, dbProductVariants } from "@repo/db";
import { eq, inArray } from "drizzle-orm";
import { createCheckoutSchema } from "@repo/validation";

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
    const validation = createCheckoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, name, phone, address } = validation.data;

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

     const tenantIdFromSlug = await getTenantId();
    if (!tenantIdFromSlug) {
      return NextResponse.json(
        { error: "Tenant no válido" },
        { status: 400 }
      );
    }

    // Validate all variants belong to the same tenant as the slug
    const tenantIds = new Set(variants.map((v) => v.tenantId));
    if (tenantIds.size > 1) {
      return NextResponse.json(
        { error: "Items de diferentes tenants no permitidos" },
        { status: 400 }
      );
    }

    // Verify the variants are from the correct tenant
    const variantTenantId = variants[0]?.tenantId;
    if (variantTenantId !== tenantIdFromSlug) {
      return NextResponse.json(
        { error: "El producto no pertenece a esta tienda" },
        { status: 400 }
      );
    }

    if (!variantTenantId) {
      return NextResponse.json(
        { error: "No se pudo determinar el tenant" },
        { status: 400 }
      );
    }

    const shippingDetails: ShippingDetails = { name, email, phone, address };

    // Use tenantIdFromSlug as the actual tenantId for the order
    const orderTenantId = tenantIdFromSlug;

    // Get customer session if authenticated
    let customerId: string | null = null;
    try {
      const session = await auth();
      customerId = session?.user?.id || null;
    } catch {
      // No session, continue as guest
    }

    const [order] = await db.transaction(async (tx) => {
      // Calculate total from cart items
      let transactionTotal = 0;
      for (const item of cart.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.price === null) {
          throw new Error(`Precio no disponible para variante ${item.variantId}`);
        }
        transactionTotal += variant.price * item.quantity;
      }

      if (transactionTotal === 0) {
        throw new Error("El total de la orden no puede ser 0");
      }

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
          tenantId: orderTenantId,
          customerId: customerId,
          status: "pending_payment",
          total: transactionTotal,
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

    await redisClient.del(`cart:${sessionId}`);

    return NextResponse.json({
      orderId: order.id,
      total: order.total,
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
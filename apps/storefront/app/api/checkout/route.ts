import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { redisClient } from "@/lib/redis";
import { getTenantId } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { withTenantContext, dbOrders, dbOrderItems, dbProductVariants, dbShippingMethods } from "@repo/db";
import { eq, inArray, and } from "drizzle-orm";
import { createCheckoutSchema } from "@repo/validation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("checkout-api");

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
  methodId?: string;
  methodName?: string;
  shippingCost?: number;
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
         { error: "Validación fallida", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, name, phone, address, shippingMethodId } = validation.data;

    const tenantIdFromSlug = await getTenantId();
    if (!tenantIdFromSlug) {
      return NextResponse.json(
        { error: "Tenant no válido" },
        { status: 400 }
      );
    }

    const variantIds = cart.items.map((item) => item.variantId);

    const result = await withTenantContext(tenantIdFromSlug, async (tx) => {
      const variants = await tx
        .select({
          id: dbProductVariants.id,
          stock: dbProductVariants.stock,
          price: dbProductVariants.price,
          tenantId: dbProductVariants.tenantId,
        })
        .from(dbProductVariants)
        .where(
          and(
            inArray(dbProductVariants.id, variantIds),
            eq(dbProductVariants.tenantId, tenantIdFromSlug)
          )
        );

      const variantMap = new Map(variants.map((v) => [v.id, v]));

      const outOfStock: string[] = [];
      for (const item of cart.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant || (variant.stock ?? 0) < item.quantity) {
          outOfStock.push(item.variantId);
        }
      }

      if (outOfStock.length > 0) {
        return { error: "Stock insuficiente", outOfStock };
      }

      let cartTotal = 0;
      for (const item of cart.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.price === null) {
          continue;
        }
        cartTotal += variant.price * item.quantity;
      }

      if (cartTotal === 0) {
        return { error: "El total del carrito no puede ser 0" };
      }

      const shippingDetails: ShippingDetails = { name, email, phone, address };
      let shippingCost = 0;
      let methodName: string | undefined;

      if (shippingMethodId) {
        const [method] = await tx
          .select()
          .from(dbShippingMethods)
          .where(
            and(
              eq(dbShippingMethods.id, shippingMethodId),
              eq(dbShippingMethods.tenantId, tenantIdFromSlug)
            )
          )
          .limit(1);

        if (!method || method.isActive !== "true") {
          return { error: "Método de envío inválido o inactivo" };
        }

        if (method.freeShippingThreshold && cartTotal >= method.freeShippingThreshold) {
          shippingCost = 0;
        } else {
          shippingCost = method.price;
        }

        methodName = method.name;
        shippingDetails.methodId = shippingMethodId;
        shippingDetails.methodName = methodName;
        shippingDetails.shippingCost = shippingCost;
      }

      let customerId: string | null = null;
      try {
        const session = await auth();
        customerId = session?.user?.id || null;
      } catch {
        // No session, continue as guest
      }

      const orderTotal = cartTotal + shippingCost;

      for (const item of cart.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) continue;

        await tx
          .update(dbProductVariants)
          .set({ stock: (variant.stock ?? 0) - item.quantity })
          .where(
            and(
              eq(dbProductVariants.id, item.variantId),
              eq(dbProductVariants.tenantId, tenantIdFromSlug)
            )
          );
      }

      const [order] = await tx
        .insert(dbOrders)
        .values({
          tenantId: tenantIdFromSlug,
          customerId,
          status: "pending_payment",
          total: orderTotal,
          currency: "UYU",
          customerEmail: email,
          shippingDetails,
        })
        .returning();

      for (const item of cart.items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) continue;

        await tx.insert(dbOrderItems).values({
          tenantId: variant.tenantId,
          orderId: order.id,
          productVariantId: item.variantId,
          quantity: item.quantity,
          unitPrice: variant.price,
        });
      }

      return { order };
    });

    if ("outOfStock" in result) {
      return NextResponse.json(
        { error: result.error, outOfStock: result.outOfStock },
        { status: 422 }
      );
    }

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    await redisClient.del(`cart:${sessionId}`);

    return NextResponse.json({
      orderId: result.order.id,
      total: result.order.total,
      status: "pending_payment",
    });
  } catch (error) {
    logger.error({ error }, "Checkout error");
    return NextResponse.json(
      { error: "Error al procesar la orden" },
      { status: 500 }
    );
  }
}
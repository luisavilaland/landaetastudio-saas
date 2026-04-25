import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders, dbOrderItems, dbProducts, dbProductVariants } from "@repo/db";
import { eq } from "drizzle-orm";
import { Preference, MercadoPagoConfig } from "mercadopago";

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "MercadoPago no configurado" },
        { status: 500 }
      );
    }

    const mpConfig = new MercadoPagoConfig({
      accessToken,
    });
    const mp = new Preference(mpConfig);

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId es requerido" },
        { status: 400 }
      );
    }

    const [order] = await db
      .select()
      .from(dbOrders)
      .where(eq(dbOrders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    const orderItems = await db
      .select({
        id: dbOrderItems.id,
        productVariantId: dbOrderItems.productVariantId,
        quantity: dbOrderItems.quantity,
        unitPrice: dbOrderItems.unitPrice,
      })
      .from(dbOrderItems)
      .where(eq(dbOrderItems.orderId, orderId));

    const variantIds = orderItems.map((item) => item.productVariantId);
    if (variantIds.length === 0) {
      return NextResponse.json(
        { error: "No hay items para pagar" },
        { status: 400 }
      );
    }

    const variants = await db
      .select({
        id: dbProductVariants.id,
        productId: dbProductVariants.productId,
      })
      .from(dbProductVariants)
      .where(eq(dbProductVariants.id, variantIds[0]));

    if (variants.length === 0) {
      return NextResponse.json(
        { error: "Variantes no encontradas" },
        { status: 404 }
      );
    }

    const productId = variants[0].productId;
    const [product] = await db
      .select({
        id: dbProducts.id,
        name: dbProducts.name,
      })
      .from(dbProducts)
      .where(eq(dbProducts.id, productId))
      .limit(1);

    const items = orderItems.map((item, index) => ({
      id: String(index),
      title: product?.name || "Producto",
      quantity: item.quantity,
      unit_price: item.unitPrice,
      currency_id: "UYU",
    }));

    const baseUrl = process.env.NEXTAUTH_URL?.replace(":3001", ":3000") || "http://localhost:3000";

    const preference = {
      items,
      back_urls: {
        success: `${baseUrl}/checkout/success?order_id=${orderId}`,
        failure: `${baseUrl}/checkout/failure?order_id=${orderId}`,
        pending: `${baseUrl}/checkout/pending?order_id=${orderId}`,
      },
      auto_return: "approved",
      external_reference: orderId,
    };

    const response = await mp.create({ body: preference });

    return NextResponse.json({
      init_point: response.init_point,
    });
  } catch (error) {
    console.error("[Checkout Preference] Error:", error);
    return NextResponse.json(
      { error: "Error al crear preferencia de pago" },
      { status: 500 }
    );
  }
}
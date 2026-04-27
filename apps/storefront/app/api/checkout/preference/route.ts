import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders, dbOrderItems, dbProducts, dbProductVariants } from "@repo/db";
import { eq, inArray } from "drizzle-orm";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken || accessToken.trim() === "") {
      return NextResponse.json(
        { error: "MercadoPago no configurado" },
        { status: 500 }
      );
    }

    if (!accessToken.startsWith("TEST-") && !accessToken.startsWith("APP_USR-")) {
      console.warn("[Preference] Token format may be invalid:", accessToken.substring(0, 20) + "...");
    }

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

    const shippingDetails = order.shippingDetails as {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
    } | null;

    if (!shippingDetails || !shippingDetails.name || !shippingDetails.email) {
      return NextResponse.json(
        { error: "Datos de envío incompletos" },
        { status: 400 }
      );
    }

    const nameParts = shippingDetails.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const payer: any = {
      name: firstName,
      surname: lastName,
      email: shippingDetails.email,
    };

    if (shippingDetails.phone) {
      payer.phone = {
        number: shippingDetails.phone,
      };
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
      .where(inArray(dbProductVariants.id, variantIds));

    if (variants.length === 0) {
      return NextResponse.json(
        { error: "Variantes no encontradas" },
        { status: 404 }
      );
    }

    const productIds = [...new Set(variants.map((v) => v.productId))];
    const products = await db
      .select({
        id: dbProducts.id,
        name: dbProducts.name,
      })
      .from(dbProducts)
      .where(inArray(dbProducts.id, productIds));

    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const variantProductMap = new Map(variants.map((v) => [v.id, v.productId]));

    const items = orderItems.map((item, index) => {
      const variantId = item.productVariantId;
      const productId = variantProductMap.get(variantId);
      const productName = productId ? (productMap.get(productId) || "Producto") : "Producto";

      return {
        id: String(index),
        title: productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        currency_id: "UYU",
      };
    });

    const baseUrl = process.env.STOREFRONT_URL;

    if (!baseUrl) {
      throw new Error("STOREFRONT_URL no está configurada. Define la URL pública del tienda (ej: https://...loca.lt)");
    }

    console.log("[Preference] orderId:", orderId);
    console.log("[Preference] items:", JSON.stringify(items));
    console.log("[Preference] baseUrl:", baseUrl);
    console.log("[Preference] accessToken:", accessToken.substring(0, 20) + "...");
    console.log("[Preference] payer:", payer);

    const preference = {
      items,
      payer,
      back_urls: {
        success: `${baseUrl}/checkout/success`,
        failure: `${baseUrl}/checkout/failure`,
        pending: `${baseUrl}/checkout/pending`,
      },
      auto_return: "approved",
      external_reference: orderId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    console.time("MP-request");

    let response: Response;
    try {
      response = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "SaaS-eCommerce/1.0",
        },
        body: JSON.stringify(preference),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.timeEnd("MP-request");
      if (fetchError.name === "AbortError") {
        console.error("[Preference] Timeout after 30s");
        return NextResponse.json(
          { error: "El servicio de pagos no está disponible temporalmente" },
          { status: 503 }
        );
      }
      console.error("[Preference] Fetch error:", fetchError.message);
      throw fetchError;
    }

    clearTimeout(timeoutId);
    console.timeEnd("MP-request");

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[Preference] API Error:", responseData);
      return NextResponse.json(responseData, { status: response.status });
    }

    const useSandbox = process.env.MP_USE_SANDBOX === "true";

    return NextResponse.json({
      init_point: useSandbox ? responseData.sandbox_init_point : responseData.init_point,
    });
  } catch (error: any) {
    console.error("[Checkout Preference] Error:", error);
    const mpError = error?.message || error?.error?.message || "Error al crear preferencia de pago";
    return NextResponse.json(
      { error: mpError, code: error?.error?.code || "UNKNOWN" },
      { status: 500 }
    );
  }
}
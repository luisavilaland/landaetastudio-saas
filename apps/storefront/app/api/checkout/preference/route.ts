import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders, dbOrderItems, dbProducts, dbProductVariants } from "@repo/db";
import { eq, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "MercadoPago no configurado" },
        { status: 500 }
      );
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

    // Get all variants (fixed bug: was only getting variantIds[0])
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

    // Get unique product IDs and fetch all products
    const productIds = [...new Set(variants.map((v) => v.productId))];
    const products = await db
      .select({
        id: dbProducts.id,
        name: dbProducts.name,
      })
      .from(dbProducts)
      .where(inArray(dbProducts.id, productIds));

    // Create product map for quick lookup
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    // Create variant -> product mapping
    const variantProductMap = new Map(variants.map((v) => [v.id, v.productId]));

    // Build items with correct product names
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Preference] WARNING: NEXT_PUBLIC_BASE_URL not set, using localhost fallback");
      } else {
        return NextResponse.json(
          { error: "NEXT_PUBLIC_BASE_URL no está configurada" },
          { status: 500 }
        );
      }
    }

    const fallbackBaseUrl = baseUrl || "http://localhost:3000";

    console.log("[Preference] orderId:", orderId);
    console.log("[Preference] items:", JSON.stringify(items));
    console.log("[Preference] baseUrl:", fallbackBaseUrl);
    console.log("[Preference] accessToken:", accessToken?.substring(0, 20) + "...");

    const preference = {
      items,
      payer: {
        name: "Test",
        surname: "User",
        email: "test_user_uy@testuser.com",
        identification: {
          type: "CI",
          number: "12345678",
        },
      },
      back_urls: {
        success: `${fallbackBaseUrl}/checkout/success`,
        failure: `${fallbackBaseUrl}/checkout/failure`,
        pending: `${fallbackBaseUrl}/checkout/pending`,
      },
      auto_return: "approved",
      external_reference: orderId,
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

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
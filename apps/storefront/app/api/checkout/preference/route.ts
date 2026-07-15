import { NextRequest, NextResponse } from "next/server";
import { withTenantContext, dbOrders, dbOrderItems, dbProducts, dbProductVariants } from "@repo/db";
import { and, eq, inArray } from "drizzle-orm";
import { checkoutPreferenceSchema } from "@repo/validation";
import { getTenantId } from "@/lib/tenant";
import { redisClient } from "@/lib/redis";
import { createLogger } from "@/lib/logger";

const logger = createLogger("checkout-preference");

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

async function rateLimitKey(ip: string): Promise<number> {
  const key = `rate_limit:checkout_preference:${ip}`;
  const current = await redisClient.incr(key);
  if (current === 1) {
    await redisClient.pexpire(key, RATE_LIMIT_WINDOW_MS);
  }
  return current;
}

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let orderId: string | undefined;
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";

    const count = await rateLimitKey(ip);
    if (count > RATE_LIMIT_MAX) {
      logger.warn({ ip, count }, "Rate limit exceeded for checkout preference");
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
        { status: 429 }
      );
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken || accessToken.trim() === "") {
      return NextResponse.json(
        { error: "MercadoPago no configurado" },
        { status: 500 }
      );
    }

    if (!accessToken.startsWith("TEST-") && !accessToken.startsWith("APP_USR-")) {
      logger.warn({ tokenPrefix: accessToken.substring(0, 20) }, "Token format may be invalid");
    }

    const body = await request.json();
    const validation = checkoutPreferenceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validación fallida", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;
    orderId = data.orderId;
    const callerEmail = data.customerEmail;

    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 400 }
      );
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "ID de orden inválido" },
        { status: 400 }
      );
    }

    const oid = orderId;

    const ctxResult = await withTenantContext(tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(dbOrders)
        .where(and(eq(dbOrders.id, oid), eq(dbOrders.tenantId, tenantId)))
        .limit(1);

      if (!order) return null;

      const orderItems = await tx
        .select({
          id: dbOrderItems.id,
          productVariantId: dbOrderItems.productVariantId,
          quantity: dbOrderItems.quantity,
          unitPrice: dbOrderItems.unitPrice,
        })
        .from(dbOrderItems)
        .where(and(eq(dbOrderItems.orderId, oid), eq(dbOrderItems.tenantId, tenantId)));

      const variantIds = orderItems.map((item) => item.productVariantId);

      const variants = variantIds.length > 0
        ? await tx
            .select({
              id: dbProductVariants.id,
              productId: dbProductVariants.productId,
            })
            .from(dbProductVariants)
            .where(and(inArray(dbProductVariants.id, variantIds), eq(dbProductVariants.tenantId, tenantId)))
        : [];

      const productIds = [...new Set(variants.map((v) => v.productId))];

      const products = productIds.length > 0
        ? await tx
            .select({
              id: dbProducts.id,
              name: dbProducts.name,
            })
            .from(dbProducts)
            .where(and(inArray(dbProducts.id, productIds), eq(dbProducts.tenantId, tenantId)))
        : [];

      return { order, orderItems, variants, products };
    });

    if (!ctxResult) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    const { order, orderItems, variants, products } = ctxResult;

    if (order.customerEmail !== callerEmail) {
      logger.warn({ orderId, callerEmail, orderEmail: order.customerEmail }, "Email mismatch — IDOR attempt");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
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
      identification: {
        type: "CI",
        number: "12345678",
      },
    };

    if (shippingDetails.phone) {
      payer.phone = {
        number: shippingDetails.phone,
      };
    }

    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: "No hay items para pagar" },
        { status: 400 }
      );
    }

    if (variants.length === 0) {
      return NextResponse.json(
        { error: "Variantes no encontradas" },
        { status: 404 }
      );
    }

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

    logger.info({ orderId, tenantId }, "Creating checkout preference");

    const preference = {
      items,
      payer,
      binary_mode: true,
      back_urls: {
        success: `${baseUrl}/checkout/success`,
        failure: `${baseUrl}/checkout/failure`,
        pending: `${baseUrl}/checkout/pending`,
      },
      auto_return: "approved",
      external_reference: `${tenantId}:${orderId}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let apiResponse: Response;
    try {
      apiResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
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
      if (fetchError.name === "AbortError") {
        logger.error({ orderId, tenantId }, "MP preference creation timeout");
        return NextResponse.json(
          { error: "El servicio de pagos no está disponible temporalmente" },
          { status: 503 }
        );
      }
      logger.error({ error: fetchError.message, orderId, tenantId }, "MP preference fetch error");
      throw fetchError;
    }

    clearTimeout(timeoutId);

    const responseData = await apiResponse.json();

    if (!apiResponse.ok) {
      logger.error({ status: apiResponse.status, orderId, tenantId }, "MP API error");
      return NextResponse.json(responseData, { status: apiResponse.status });
    }

    const useSandbox = accessToken.startsWith("TEST-");
    const initPoint = useSandbox ? responseData.sandbox_init_point : responseData.init_point;

    logger.info({ preferenceId: responseData.id, useSandbox, orderId, tenantId }, "Preference created");

    return NextResponse.json({
      init_point: initPoint,
    });
  } catch (error: any) {
    logger.error({ error: error?.message, orderId }, "Checkout preference error");
    const mpError = error?.message || error?.error?.message || "Error al crear preferencia de pago";
    return NextResponse.json(
      { error: mpError, code: error?.error?.code || "UNKNOWN" },
      { status: 500 }
    );
  }
}
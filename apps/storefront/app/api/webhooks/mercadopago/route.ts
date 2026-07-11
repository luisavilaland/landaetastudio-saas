import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders, dbOrderItems, dbProductVariants } from "@repo/db";
import { and, eq, sql } from "drizzle-orm";
import { sendOrderConfirmationEmail } from "@/lib/email";
import crypto from "crypto";
import { webhookSchema } from "@repo/validation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("webhook-mercadopago");

type MPWebhookPayload = {
  type: string;
  data: {
    id: string;
  };
};

type MPPaymentResponse = {
  id: number;
  external_reference: string | null;
  status: string;
  status_detail: string;
  payment_type: string;
  transaction_amount: number;
};

async function fetchPaymentDetails(paymentId: string, accessToken: string): Promise<MPPaymentResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "SaaS-eCommerce/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error({ paymentId, status: response.status }, "Failed to fetch payment");
      return null;
    }

    return await response.json() as MPPaymentResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    logger.error({ paymentId, error: error.message }, "Error fetching payment");
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error("MERCADOPAGO_WEBHOOK_SECRET not configured — rejecting webhook");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-signature");

    if (!signature) {
      logger.warn("Missing x-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const requestId = request.headers.get("x-request-id");
    const dataToSign = requestId
      ? `${rawBody}.${requestId}`
      : rawBody;
    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(dataToSign).digest("hex");

    if (signature !== expectedSignature) {
      logger.warn("Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    logger.debug("Signature verified");

    const parsedBody = JSON.parse(rawBody);
    const validation = webhookSchema.safeParse(parsedBody);

    if (!validation.success) {
      logger.warn({ issues: validation.error.issues }, "Invalid webhook payload");
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const body = validation.data;
    logger.info({ paymentId: body.data?.id }, "Received webhook");

    const paymentId = body.data?.id;
    if (!paymentId) {
      logger.warn("No payment_id found in webhook data");
      return NextResponse.json({ error: "No payment_id" }, { status: 400 });
    }

    let paymentStatusFromSim: string | null = null;
    let mockExternalRef: string | null = null;
    if (process.env.NODE_ENV === "development" && paymentId === "123456789") {
      paymentStatusFromSim = "approved";
      mockExternalRef = request.headers.get("x-test-order-id");
      logger.info("Dev mode: simulating approved payment");
    } else if (process.env.NODE_ENV === "development" && paymentId === "000000") {
      paymentStatusFromSim = "rejected";
      mockExternalRef = request.headers.get("x-test-order-id");
      logger.info("Dev mode: simulating rejected payment");
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      logger.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    let payment;
    if (paymentStatusFromSim) {
      payment = {
        id: parseInt(paymentId),
        external_reference: null as any,
        status: paymentStatusFromSim,
        status_detail: "simulated",
        payment_type: "card",
        transaction_amount: 0,
      };
    } else {
      payment = await fetchPaymentDetails(paymentId, accessToken);
      if (!payment) {
        logger.error({ paymentId }, "Could not fetch payment details");
        return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
      }
    }

    logger.info({ paymentId, status: payment.status, statusDetail: payment.status_detail }, "Payment status");
    
    let orderId: string | null = mockExternalRef || payment.external_reference;

    if (!orderId) {
      logger.info({ paymentId }, "No external_reference found");
      return NextResponse.json({ received: true, message: "No external_reference found" });
    }

    if (mockExternalRef) {
      logger.debug({ orderId }, "Using test order ID from header");
    }

    logger.debug({ orderId }, "Order ID from external_reference");

    const [order] = await db
      .select()
      .from(dbOrders)
      .where(eq(dbOrders.id, orderId))
      .limit(1);

    if (!order) {
      logger.warn({ orderId }, "Order not found");
      return NextResponse.json({ received: true });
    }

    const tenantId = order.tenantId;

    let newStatus: string | null = null;

    if (payment.status === "approved") {
      newStatus = "confirmed";
    } else if (
      payment.status === "rejected" ||
      payment.status === "cancelled" ||
      payment.status === "refunded" ||
      payment.status_detail === "reject_insufficient_data"
    ) {
      newStatus = "payment_failed";
    }

    if (!newStatus) {
      logger.debug({ paymentId, paymentStatus: payment.status }, "No status update needed");
      return NextResponse.json({ received: true });
    }

    if (newStatus === "confirmed") {
      const metadata = order.metadata as { paymentId?: string } | undefined;
      if (metadata?.paymentId) {
        logger.info({ orderId, paymentId }, "Payment already processed");
        return NextResponse.json({ received: true });
      }

      await db
        .update(dbOrders)
        .set({
          status: newStatus,
          metadata: {
            paymentId,
            paymentStatus: payment.status,
            webhookReceivedAt: new Date().toISOString(),
          },
        })
        .where(and(eq(dbOrders.id, orderId), eq(dbOrders.tenantId, tenantId)));

      logger.info({ orderId, newStatus }, "Order updated");

      if (order?.customerEmail && order?.total && order?.shippingDetails) {
        const shippingDetails = order.shippingDetails as { name?: string };
        await sendOrderConfirmationEmail(
          order.customerEmail,
          orderId,
          order.total,
          shippingDetails.name || "Cliente"
        );
      }
    } else if (newStatus === "payment_failed") {
      if (order.status === "payment_failed") {
        logger.info({ orderId }, "Order already failed, skipping restoration");
        return NextResponse.json({ received: true });
      }

      const orderItems = await db
        .select()
        .from(dbOrderItems)
        .where(eq(dbOrderItems.orderId, orderId));

      for (const item of orderItems) {
        const [variant] = await db
          .select({ stock: dbProductVariants.stock })
          .from(dbProductVariants)
          .where(and(eq(dbProductVariants.id, item.productVariantId), eq(dbProductVariants.tenantId, tenantId)))
          .limit(1);

        if (variant && variant.stock !== null) {
          await db
            .update(dbProductVariants)
            .set({
              stock: variant.stock + item.quantity,
            })
            .where(and(eq(dbProductVariants.id, item.productVariantId), eq(dbProductVariants.tenantId, tenantId)));

          logger.info({ orderId, productVariantId: item.productVariantId, quantity: item.quantity }, "Stock restored");
        }
      }

      await db
        .update(dbOrders)
        .set({
          status: newStatus,
          metadata: {
            paymentId,
            paymentStatus: payment.status,
            webhookReceivedAt: new Date().toISOString(),
            stockRestored: true,
          },
        })
        .where(and(eq(dbOrders.id, orderId), eq(dbOrders.tenantId, tenantId)));

      logger.info({ orderId, newStatus }, "Order updated and stock restored");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ error }, "Webhook error");
    return NextResponse.json({ received: true });
  }
}

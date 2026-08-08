import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders, dbOrderItems, dbProductVariants, withTenantContext } from "@repo/db";
import { and, eq, sql } from "drizzle-orm";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { webhookSchema } from "@repo/validation";
import { verifyMercadoPagoSignature } from "@repo/commerce/webhook-signature";
import { createLogger } from "@/lib/logger";

const logger = createLogger("webhook-mercadopago");

const SIM_PAYMENT_STATUS: Record<string, string> = {
  "123456789": "approved",
  "000000": "rejected",
  "999999": "pending",
};

function extractDataId(rawBody: string): string | undefined {
  try {
    const parsed = JSON.parse(rawBody) as { data?: { id?: string } };
    return parsed.data?.id;
  } catch {
    return undefined;
  }
}

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

    const bypassVerified = process.env.BYPASS_WEBHOOK_SIGNATURE === "true" && process.env.NODE_ENV !== "production";
    if (bypassVerified) {
      logger.debug("Bypassing signature verification (dev only)");
    } else {
      const dataId = extractDataId(rawBody);
      const result = verifyMercadoPagoSignature({
        signatureHeader: signature,
        xRequestId: request.headers.get("x-request-id") ?? "",
        dataId: dataId ?? "",
        secret: webhookSecret,
      });

      if (!result.valid) {
        logger.warn({ reason: result.reason }, "Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      logger.debug("Signature verified");
    }

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
    const simMode =
      process.env.NODE_ENV === "development" || process.env.E2E_WEBHOOK_TEST === "1";
    const simStatus = simMode ? SIM_PAYMENT_STATUS[paymentId] ?? null : null;
    if (simStatus) {
      paymentStatusFromSim = simStatus;
      mockExternalRef = request.headers.get("x-test-order-id");
      logger.info({ paymentId, simStatus }, "Simulated payment via magic ID");
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
    
    const externalRef: string | null = mockExternalRef || payment.external_reference;

    if (!externalRef) {
      logger.info({ paymentId }, "No external_reference found");
      return NextResponse.json({ received: true, message: "No external_reference found" });
    }

    const refParts = externalRef.split(":");
    if (refParts.length !== 2) {
      logger.error({ externalRef }, "external_reference sin tenantId — orden pre-deploy, reconciliar manualmente");
      return NextResponse.json({ received: true });
    }
    const [tenantId, orderId] = refParts;

    if (mockExternalRef) {
      logger.debug({ orderId, tenantId }, "Using test order ID from header");
    }

    logger.debug({ orderId, tenantId }, "Order ID and tenant from external_reference");

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
      const emailData = await withTenantContext(tenantId, async (tx) => {
        const [order] = await tx
          .select()
          .from(dbOrders)
          .where(and(eq(dbOrders.id, orderId), eq(dbOrders.tenantId, tenantId)))
          .limit(1);

        if (!order) {
          logger.warn({ orderId, tenantId }, "Order not found");
          return null;
        }

        const metadata = order.metadata as { paymentId?: string } | undefined;
        if (metadata?.paymentId) {
          logger.info({ orderId, paymentId }, "Payment already processed");
          return null;
        }

        await tx
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

        return {
          customerEmail: order.customerEmail,
          total: order.total,
          shippingName: (order.shippingDetails as { name?: string } | null)?.name || "Cliente",
        };
      });

      logger.info({ orderId, newStatus }, "Order updated");

      if (emailData?.customerEmail && emailData?.total) {
        await sendOrderConfirmationEmail(
          emailData.customerEmail,
          orderId,
          emailData.total,
          emailData.shippingName
        );
      }
    } else if (newStatus === "payment_failed") {
      await withTenantContext(tenantId, async (tx) => {
        const [order] = await tx
          .select({ status: dbOrders.status })
          .from(dbOrders)
          .where(and(eq(dbOrders.id, orderId), eq(dbOrders.tenantId, tenantId)))
          .limit(1);

        if (!order || order.status === "payment_failed") {
          logger.info({ orderId }, "Order already failed, skipping restoration");
          return;
        }

        const orderItems = await tx
          .select()
          .from(dbOrderItems)
          .where(and(eq(dbOrderItems.orderId, orderId), eq(dbOrderItems.tenantId, tenantId)));

        for (const item of orderItems) {
          const [variant] = await tx
            .select({ stock: dbProductVariants.stock })
            .from(dbProductVariants)
            .where(and(eq(dbProductVariants.id, item.productVariantId), eq(dbProductVariants.tenantId, tenantId)))
            .limit(1);

          if (variant && variant.stock !== null) {
            await tx
              .update(dbProductVariants)
              .set({ stock: variant.stock + item.quantity })
              .where(and(eq(dbProductVariants.id, item.productVariantId), eq(dbProductVariants.tenantId, tenantId)));
          }
        }

        await tx
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
      });

      logger.info({ orderId, newStatus }, "Order updated and stock restored");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ error }, "Webhook error");
    return NextResponse.json({ received: true });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders, dbOrderItems, dbProductVariants } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { sendOrderConfirmationEmail } from "@/lib/email";
import crypto from "crypto";

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
      console.error(`[Webhook MP] Failed to fetch payment ${paymentId}: ${response.status}`);
      return null;
    }

    return await response.json() as MPPaymentResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[Webhook MP] Error fetching payment ${paymentId}:`, error.message);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (webhookSecret) {
      const signature = request.headers.get("x-signature");
      const requestId = request.headers.get("x-request-id");
      if (!signature) {
        console.warn("[Webhook MP] Missing x-signature header");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      
      const dataToSign = requestId 
        ? `${await request.text()}.${requestId}` 
        : await request.text();
      const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(dataToSign).digest("hex");
      
      if (signature !== expectedSignature) {
        console.warn("[Webhook MP] Invalid signature");
        console.warn("[Webhook MP] Expected:", expectedSignature);
        console.warn("[Webhook MP] Received:", signature);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      console.log("[Webhook MP] Signature verified");
    } else {
      console.log("[Webhook MP] Signature verification disabled (no secret configured)");
    }

    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as MPWebhookPayload;
    console.log("[Webhook MP] Received webhook:", JSON.stringify(body));

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.log("[Webhook MP] No payment_id found in webhook data");
      return NextResponse.json({ error: "No payment_id" }, { status: 400 });
    }

    console.log("[Webhook MP] Payment ID:", paymentId);

    let paymentStatusFromSim: string | null = null;
    let mockExternalRef: string | null = null;
    if (process.env.NODE_ENV === "development" && paymentId === "123456789") {
      paymentStatusFromSim = "approved";
      mockExternalRef = request.headers.get("x-test-order-id");
      console.log("[Webhook MP] Dev mode: simulating approved payment");
    } else if (process.env.NODE_ENV === "development" && paymentId === "000000") {
      paymentStatusFromSim = "rejected";
      mockExternalRef = request.headers.get("x-test-order-id");
      console.log("[Webhook MP] Dev mode: simulating rejected payment");
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[Webhook MP] MERCADOPAGO_ACCESS_TOKEN not configured");
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
        console.error(`[Webhook MP] Could not fetch payment details for ${paymentId}`);
        return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
      }
    }

    console.log("[Webhook MP] Payment status:", payment.status);
    console.log("[Webhook MP] Payment status_detail:", payment.status_detail);
    
    let orderId: string | null = mockExternalRef || payment.external_reference;
    if (!orderId) {
      orderId = request.headers.get("x-test-order-id");
    }
    
    if (!orderId) {
      console.log("[Webhook MP] No external_reference found - not retrying");
      return NextResponse.json({ received: true, message: "No external_reference found" });
    }

    if (mockExternalRef) {
      console.log("[Webhook MP] Using test order ID from header:", orderId);
    }

    console.log("[Webhook MP] Order ID from external_reference:", orderId);

    const [order] = await db
      .select()
      .from(dbOrders)
      .where(eq(dbOrders.id, orderId))
      .limit(1);

    if (!order) {
      console.log(`[Webhook MP] Order ${orderId} not found`);
      return NextResponse.json({ received: true });
    }

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
      console.log(`[Webhook MP] No status update for payment status: ${payment.status}`);
      return NextResponse.json({ received: true });
    }

    if (newStatus === "confirmed") {
      const metadata = order.metadata as { paymentId?: string } | undefined;
      if (metadata?.paymentId) {
        console.log(`[Webhook MP] Payment ${paymentId} already processed for order ${orderId}`);
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
        .where(eq(dbOrders.id, orderId));

      console.log(`[Webhook MP] Order ${orderId} updated to ${newStatus}`);

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
        console.log(`[Webhook MP] Order ${orderId} already failed, skipping restoration`);
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
          .where(eq(dbProductVariants.id, item.productVariantId))
          .limit(1);

        if (variant && variant.stock !== null) {
          await db
            .update(dbProductVariants)
            .set({
              stock: variant.stock + item.quantity,
            })
            .where(eq(dbProductVariants.id, item.productVariantId));

          console.log(`[Webhook MP] Restored ${item.quantity} units to variant ${item.productVariantId}`);
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
        .where(eq(dbOrders.id, orderId));

      console.log(`[Webhook MP] Order ${orderId} updated to ${newStatus} and stock restored`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook MP] Error:", error);
    return NextResponse.json({ received: true });
  }
}
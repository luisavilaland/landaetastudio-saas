import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders, dbOrderItems, dbProductVariants } from "@repo/db";
import { eq } from "drizzle-orm";
import { sendOrderConfirmationEmail } from "@/lib/email";
import crypto from "crypto";

type MPWebhookPayload = {
  type: string;
  data: {
    id: string;
  };
  external_reference?: string;
  status?: string;
};

function verifySignature(
  signature: string | null,
  requestId: string | null,
  rawBody: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.log("[Webhook MP] Missing signature or secret");
    return false;
  }

  const dataToSign = requestId ? `${rawBody}.${requestId}` : rawBody;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const signature = request.headers.get("x-signature");
    const requestId = request.headers.get("x-request-id");
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const bypassSignature = process.env.BYPASS_WEBHOOK_SIGNATURE === "true";
    const isDevelopment = process.env.NODE_ENV === "development";

    if (!bypassSignature && !isDevelopment) {
      const isValid = verifySignature(signature, requestId, rawBody, webhookSecret || "");
      if (!isValid) {
        console.log("[Webhook MP] Invalid signature");
        console.log("[Webhook MP] Expected signature from:", signature);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (!webhookSecret && !bypassSignature) {
      console.warn("[Webhook MP] WARNING: MERCADOPAGO_WEBHOOK_SECRET not configured");
    } else if (isDevelopment || bypassSignature) {
      console.log("[Webhook MP] Signature verification bypassed (dev mode)");
    }

    const body = JSON.parse(rawBody) as MPWebhookPayload;

    console.log("[Webhook MP] Received:", JSON.stringify(body));

    const paymentId = body.data?.id;
    const orderId = body.external_reference;
    const eventType = body.type;

    if (!orderId) {
      console.log("[Webhook MP] No external_reference found, ignoring");
      return NextResponse.json({ received: true });
    }

    let newStatus: string | null = null;

    if (eventType === "payment") {
      const paymentStatus = body.status;
      if (paymentStatus === "approved") {
        newStatus = "confirmed";
      } else if (
        paymentStatus === "rejected" ||
        paymentStatus === "cancelled" ||
        paymentStatus === "refunded"
      ) {
        newStatus = "payment_failed";
      }
    }

    if (newStatus && newStatus === "confirmed") {
      const [order] = await db
        .select()
        .from(dbOrders)
        .where(eq(dbOrders.id, orderId))
        .limit(1);

      if (!order) {
        console.log(`[Webhook MP] Order ${orderId} not found`);
        return NextResponse.json({ received: true });
      }

      // Check if payment already processed (prevent duplicate)
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
            paymentStatus: body.status,
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
      const [order] = await db
        .select()
        .from(dbOrders)
        .where(eq(dbOrders.id, orderId))
        .limit(1);

      if (!order) {
        console.log(`[Webhook MP] Order ${orderId} not found`);
        return NextResponse.json({ received: true });
      }

      // Check if already marked as payment_failed (prevent double restoration)
      if (order.status === "payment_failed") {
        console.log(`[Webhook MP] Order ${orderId} already failed, skipping restoration`);
        return NextResponse.json({ received: true });
      }

      // Get order items to restore stock
      const orderItems = await db
        .select()
        .from(dbOrderItems)
        .where(eq(dbOrderItems.orderId, orderId));

      // Restore stock for each item in a transaction-like manner
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
            paymentStatus: body.status,
            webhookReceivedAt: new Date().toISOString(),
            stockRestored: true,
          },
        })
        .where(eq(dbOrders.id, orderId));

      console.log(`[Webhook MP] Order ${orderId} updated to ${newStatus} and stock restored`);
    } else if (newStatus) {
      const [order] = await db
        .select()
        .from(dbOrders)
        .where(eq(dbOrders.id, orderId))
        .limit(1);

      if (!order) {
        console.log(`[Webhook MP] Order ${orderId} not found`);
        return NextResponse.json({ received: true });
      }

      await db
        .update(dbOrders)
        .set({
          status: newStatus,
          metadata: {
            paymentId,
            paymentStatus: body.status,
            webhookReceivedAt: new Date().toISOString(),
          },
        })
        .where(eq(dbOrders.id, orderId));

      console.log(`[Webhook MP] Order ${orderId} updated to ${newStatus}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook MP] Error:", error);
    return NextResponse.json({ received: true });
  }
}
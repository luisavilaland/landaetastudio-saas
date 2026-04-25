import { NextRequest, NextResponse } from "next/server";
import { db, dbOrders } from "@repo/db";
import { eq } from "drizzle-orm";
import { sendOrderConfirmationEmail } from "@/lib/email";

type MPWebhookPayload = {
  type: string;
  data: {
    id: string;
  };
  external_reference?: string;
  status?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MPWebhookPayload;

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
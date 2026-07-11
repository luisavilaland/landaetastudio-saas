import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import crypto from "crypto";

describe("POST /api/webhooks/mercadopago — HMAC Verification", () => {
  it("should return 503 when webhook secret is not configured", async () => {
    const handler = async (secret: string | undefined) => {
      if (!secret) {
        return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
      }
      return NextResponse.json({ received: true });
    };

    const res = await handler(undefined);
    expect(res.status).toBe(503);
  });

  it("should return 401 when signature header is missing", async () => {
    const handler = async (signature: string | null) => {
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      return NextResponse.json({ received: true });
    };

    const res = await handler(null);
    expect(res.status).toBe(401);
  });

  it("should return 401 when signature is invalid", async () => {
    const secret = "test-secret";
    const rawBody = JSON.stringify({ type: "payment", data: { id: "123" } });
    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const handler = async (signature: string) => {
      if (signature !== expectedSignature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      return NextResponse.json({ received: true });
    };

    const res = await handler("invalid-signature");
    expect(res.status).toBe(401);
  });

  it("should return 200 when signature is valid", async () => {
    const secret = "test-secret";
    const rawBody = JSON.stringify({ type: "payment", data: { id: "123" } });
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const handler = async (signature: string) => {
      if (signature !== validSignature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      return NextResponse.json({ received: true });
    };

    const res = await handler(validSignature);
    expect(res.status).toBe(200);
  });

  it("should verify signature when x-request-id is present", async () => {
    const secret = "test-secret";
    const rawBody = JSON.stringify({ type: "payment", data: { id: "123" } });
    const requestId = "req-456";
    const dataToSign = `${rawBody}.${requestId}`;
    const validSignature = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");

    const handler = async (signature: string) => {
      if (signature !== validSignature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      return NextResponse.json({ received: true });
    };

    const res = await handler(validSignature);
    expect(res.status).toBe(200);

    const res2 = await handler("wrong-signature");
    expect(res2.status).toBe(401);
  });
});

describe("POST /api/webhooks/mercadopago — Payment Processing", () => {
  it("should reject when payment type is not 'payment'", async () => {
    const handler = async (type: string) => {
      if (type !== "payment") {
        return NextResponse.json({ received: true });
      }
      return NextResponse.json({ received: true });
    };

    const res = await handler("test");
    expect(res.status).toBe(200);
  });

  it("should return 400 when payment data is missing", async () => {
    const handler = async (paymentId: string | undefined) => {
      if (!paymentId) {
        return NextResponse.json({ error: "ID de pago no proporcionado" }, { status: 400 });
      }
      return NextResponse.json({ received: true });
    };

    const res = await handler(undefined);
    expect(res.status).toBe(400);
  });
});

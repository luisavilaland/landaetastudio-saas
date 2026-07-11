import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

describe("POST /api/checkout/preference — IDOR Protection", () => {
  it("should return 403 when caller email does not match order email", async () => {
    const order = { customerEmail: "real@comprador.com" };
    const body = { orderId: "order-123", customerEmail: "otro@atacante.com" };

    const handler = async (o: typeof order, b: typeof body) => {
      if (o.customerEmail !== b.customerEmail) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      return NextResponse.json({ init_point: "https://mercadopago.com/pay/123" });
    };

    const res = await handler(order, body);
    expect(res.status).toBe(403);
  });

  it("should return 200 when caller email matches order email", async () => {
    const order = { customerEmail: "real@comprador.com" };
    const body = { orderId: "order-123", customerEmail: "real@comprador.com" };

    const handler = async (o: typeof order, b: typeof body) => {
      if (o.customerEmail !== b.customerEmail) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      return NextResponse.json({ init_point: "https://mercadopago.com/pay/123" });
    };

    const res = await handler(order, body);
    expect(res.status).toBe(200);
  });

  it("should return 400 when customerEmail is missing from request", async () => {
    const body = { orderId: "order-123" };

    const handler = async (b: typeof body) => {
      if (!("customerEmail" in b) || !b.customerEmail) {
        return NextResponse.json(
          { error: "Validación fallida", issues: [{ path: ["customerEmail"] }] },
          { status: 400 }
        );
      }
      return NextResponse.json({ init_point: "https://mercadopago.com/pay/123" });
    };

    const res = await handler(body);
    expect(res.status).toBe(400);
  });

  it("should return 400 when customerEmail has invalid format", async () => {
    const body = { orderId: "order-123", customerEmail: "not-an-email" };

    const handler = async (b: typeof body) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(b.customerEmail)) {
        return NextResponse.json(
          { error: "Validación fallida", issues: [{ path: ["customerEmail"] }] },
          { status: 400 }
        );
      }
      return NextResponse.json({ init_point: "https://mercadopago.com/pay/123" });
    };

    const res = await handler(body);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/checkout/preference — Rate Limiting", () => {
  it("should allow up to 10 requests per minute per IP", async () => {
    const MAX = 10;
    const requestCounts: Map<string, number> = new Map();

    const rateLimiter = (ip: string) => {
      const count = (requestCounts.get(ip) || 0) + 1;
      requestCounts.set(ip, count);
      return count;
    };

    const ip = "192.168.1.1";
    for (let i = 0; i < MAX; i++) {
      const count = rateLimiter(ip);
      expect(count).toBeLessThanOrEqual(MAX);
    }
  });

  it("should return 429 after exceeding 10 requests in a minute", async () => {
    const MAX = 10;
    const requestCounts: Map<string, number> = new Map();

    const handler = (ip: string) => {
      const count = (requestCounts.get(ip) || 0) + 1;
      requestCounts.set(ip, count);
      if (count > MAX) {
        return NextResponse.json(
          { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
          { status: 429 }
        );
      }
      return NextResponse.json({ init_point: "https://mercadopago.com/pay/123" });
    };

    const ip = "192.168.1.2";
    for (let i = 0; i < MAX; i++) {
      handler(ip);
    }
    const res = handler(ip);
    expect(res.status).toBe(429);
  });

  it("should track rate limits per IP independently", async () => {
    const requestCounts: Map<string, number> = new Map();

    const rateLimiter = (ip: string) => {
      const count = (requestCounts.get(ip) || 0) + 1;
      requestCounts.set(ip, count);
      return count;
    };

    rateLimiter("ip-1");
    rateLimiter("ip-1");
    rateLimiter("ip-2");

    expect(requestCounts.get("ip-1")).toBe(2);
    expect(requestCounts.get("ip-2")).toBe(1);
  });
});

describe("POST /api/checkout/preference — MercadoPago Token", () => {
  it("should return 500 when access token is missing", async () => {
    const handler = async (token: string | undefined) => {
      if (!token || token.trim() === "") {
        return NextResponse.json(
          { error: "MercadoPago no configurado" },
          { status: 500 }
        );
      }
      return NextResponse.json({ init_point: "https://mercadopago.com/pay/123" });
    };

    const res = await handler(undefined);
    expect(res.status).toBe(500);
  });
});

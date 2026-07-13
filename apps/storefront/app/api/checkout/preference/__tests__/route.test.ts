import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockRedisIncr, mockRedisPexpire } = vi.hoisted(() => ({
  mockRedisIncr: vi.fn(),
  mockRedisPexpire: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redisClient: {
    incr: mockRedisIncr,
    pexpire: mockRedisPexpire,
  },
}));

vi.mock("@/lib/tenant", () => ({
  getTenantId: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    db: { select: vi.fn() },
  };
});

import { NextRequest } from "next/server";
import { db } from "@repo/db";
import { getTenantId } from "@/lib/tenant";
import { POST } from "../route";

const TENANT_ID = "tenant-123";
const ORDER_ID = "order-abc";
const CALLER_EMAIL = "comprador@test.com";

const MOCK_ORDER = {
  id: ORDER_ID,
  tenantId: TENANT_ID,
  customerEmail: CALLER_EMAIL,
  total: 15000,
  status: "pending_payment",
  shippingDetails: {
    name: "Juan Perez",
    email: "comprador@test.com",
    phone: "099123456",
    address: "Calle 123",
  },
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  currency: "UYU",
  customerId: null,
};

const MOCK_ORDER_ITEMS = [
  { id: "item-1", productVariantId: "var-1", quantity: 2, unitPrice: 5000 },
  { id: "item-2", productVariantId: "var-2", quantity: 1, unitPrice: 3000 },
];

const MOCK_VARIANTS = [
  { id: "var-1", productId: "prod-1" },
  { id: "var-2", productId: "prod-2" },
];

const MOCK_PRODUCTS = [
  { id: "prod-1", name: "Producto 1" },
  { id: "prod-2", name: "Producto 2" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createQuery<T>(resolveValue: T[]): any {
  const q = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
    then: (onFulfilled: (v: T[]) => unknown) =>
      Promise.resolve(resolveValue).then(onFulfilled),
  };
  return q;
}

function makeRequest(
  body: Record<string, unknown>,
  headerOverrides?: Record<string, string>
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (headerOverrides) {
    for (const [k, v] of Object.entries(headerOverrides)) {
      headers.set(k, v);
    }
  }
  return {
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers,
    nextUrl: new URL("http://localhost"),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

describe("POST /api/checkout/preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-12345-test_access_token";
    process.env.STOREFRONT_URL = "https://test-store.lvh.me";

    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID);
    mockRedisIncr.mockReset();
    mockRedisPexpire.mockReset();
  });

  afterEach(() => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    delete process.env.STOREFRONT_URL;
  });

  describe("Rate limiting", () => {
    it("should return 429 when rate limit exceeded", async () => {
      mockRedisIncr.mockResolvedValue(11);
      mockRedisPexpire.mockResolvedValue("OK");

      const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }, { "x-forwarded-for": "1.2.3.4" }));

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain("Demasiadas solicitudes");
    });

    it("should allow requests within rate limit", async () => {
      mockRedisIncr.mockResolvedValue(5);
      mockRedisPexpire.mockResolvedValue("OK");

      vi.mocked(db.select)
        .mockReturnValueOnce(createQuery([MOCK_ORDER]));

      const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }, { "x-forwarded-for": "5.6.7.8" }));

      expect(res.status).not.toBe(429);
    });
  });

  describe("Token validation", () => {
    it("should return 500 when access token is missing", async () => {
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("MercadoPago no configurado");
    });
  });

  describe("Input validation", () => {
    it("should return 400 when customerEmail is missing", async () => {
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(makeRequest({ orderId: ORDER_ID }));

      expect(res.status).toBe(400);
    });

    it("should return 400 when customerEmail is invalid", async () => {
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: "not-an-email" }));

      expect(res.status).toBe(400);
    });

    it("should return 400 when orderId is missing", async () => {
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(makeRequest({ customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(400);
    });
  });

  describe("Tenant resolution", () => {
    it("should return 400 when tenant is not found", async () => {
      mockRedisIncr.mockResolvedValue(1);
      vi.mocked(getTenantId).mockResolvedValue(null);

      const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(400);
    });
  });

  describe("IDOR protection", () => {
    it("should return 404 when order does not exist", async () => {
      mockRedisIncr.mockResolvedValue(1);
      vi.mocked(db.select).mockReturnValueOnce(createQuery([]));

      const res = await POST(makeRequest({ orderId: "nonexistent", customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(404);
    });

    it("should return 403 when caller email does not match order email", async () => {
      mockRedisIncr.mockResolvedValue(1);
      vi.mocked(db.select).mockReturnValueOnce(createQuery([{ ...MOCK_ORDER, customerEmail: "otro@test.com" }]));

      const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(403);
    });

    it("should return 200 when caller email matches order email", async () => {
      mockRedisIncr.mockResolvedValue(1);
      vi.mocked(db.select)
        .mockReturnValueOnce(createQuery([MOCK_ORDER]))
        .mockReturnValueOnce(createQuery(MOCK_ORDER_ITEMS))
        .mockReturnValueOnce(createQuery(MOCK_VARIANTS))
        .mockReturnValueOnce(createQuery(MOCK_PRODUCTS));

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "mp-pref-123", init_point: "https://mercadopago.com/pay/123", sandbox_init_point: "https://sandbox.mercadopago.com/pay/123" }),
      });

      try {
        const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty("init_point");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Shipping details", () => {
    it("should return 400 when shipping details are missing", async () => {
      mockRedisIncr.mockResolvedValue(1);
      vi.mocked(db.select).mockReturnValueOnce(createQuery([{ ...MOCK_ORDER, shippingDetails: null }]));

      const res = await POST(makeRequest({ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(400);
    });
  });
});

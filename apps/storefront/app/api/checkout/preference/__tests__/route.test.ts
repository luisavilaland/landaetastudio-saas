import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockRedisIncr, mockRedisPexpire } = vi.hoisted(() => ({
  mockRedisIncr: vi.fn(),
  mockRedisPexpire: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redisIncr: mockRedisIncr,
  redisPexpire: mockRedisPexpire,
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
  return { ...actual, withTenantContext: vi.fn() };
});

import { withTenantContext } from "@repo/db";
import { makeTxMock, mockReq } from "@repo/test-utils";
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

describe("POST /api/checkout/preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-12345-test_access_token";

    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID);
    mockRedisIncr.mockReset();
    mockRedisPexpire.mockReset();
  });

  afterEach(() => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  });

  describe("Rate limiting", () => {
    it("should return 429 when rate limit exceeded", async () => {
      mockRedisIncr.mockResolvedValue(11);
      mockRedisPexpire.mockResolvedValue("OK");

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }, { "x-forwarded-for": "1.2.3.4" }));

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain("Demasiadas solicitudes");
    });

    it("should allow requests within rate limit", async () => {
      mockRedisIncr.mockResolvedValue(5);
      mockRedisPexpire.mockResolvedValue("OK");

      const tx = makeTxMock({ select: [{ data: [MOCK_ORDER], terminal: "limit" }] });
      vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }, { "x-forwarded-for": "5.6.7.8" }));

      expect(res.status).not.toBe(429);
      expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    });

    it("should fail open (skip rate limit) when Redis is unavailable", async () => {
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
      mockRedisIncr.mockResolvedValue(null);

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }, { "x-forwarded-for": "9.9.9.9" }));

      expect(res.status).not.toBe(429);
      const body = await res.json();
      expect(body.error).toBe("MercadoPago no configurado");
    });
  });

  describe("Token validation", () => {
    it("should return 500 when access token is missing", async () => {
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("MercadoPago no configurado");
    });
  });

  describe("Input validation", () => {
    it("should return 400 when customerEmail is missing", async () => {
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID }));

      expect(res.status).toBe(400);
    });

    it("should return 400 when customerEmail is invalid", async () => {
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: "not-an-email" }));

      expect(res.status).toBe(400);
    });

    it("should return 400 when orderId is missing", async () => {
      mockRedisIncr.mockResolvedValue(1);

      const res = await POST(mockReq("POST",{ customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(400);
    });
  });

  describe("Tenant resolution", () => {
    it("should return 400 when tenant is not found", async () => {
      mockRedisIncr.mockResolvedValue(1);
      vi.mocked(getTenantId).mockResolvedValue(null);

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(400);
    });
  });

  describe("IDOR protection", () => {
    it("should return 404 when order does not exist", async () => {
      mockRedisIncr.mockResolvedValue(1);
      const tx = makeTxMock({ select: [{ data: [], terminal: "limit" }] });
      vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

      const res = await POST(mockReq("POST",{ orderId: "nonexistent", customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(404);
      expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    });

    it("should return 403 when caller email does not match order email", async () => {
      mockRedisIncr.mockResolvedValue(1);
      const tx = makeTxMock({ select: [
        { data: [{ ...MOCK_ORDER, customerEmail: "otro@test.com" }], terminal: "limit" },
        { data: [] },
        { data: [] },
        { data: [] },
      ] });
      vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(403);
      expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    });

    it("should return 200 when caller email matches order email", async () => {
      mockRedisIncr.mockResolvedValue(1);
      const tx = makeTxMock({ select: [
        { data: [MOCK_ORDER], terminal: "limit" },
        { data: MOCK_ORDER_ITEMS },
        { data: MOCK_VARIANTS },
        { data: MOCK_PRODUCTS },
      ] });
      vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

      const originalFetch = globalThis.fetch;
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "mp-pref-123", init_point: "https://mercadopago.com/pay/123", sandbox_init_point: "https://sandbox.mercadopago.com/pay/123" }),
      });
      globalThis.fetch = mockFetch;

      try {
        const res = await POST(mockReq(
          "POST",
          { orderId: ORDER_ID, customerEmail: CALLER_EMAIL },
          { host: "tienda1.landaetastudio.com", "x-forwarded-proto": "https" }
        ));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty("init_point");
        expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));

        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
        const preference = JSON.parse((init as RequestInit).body as string);
        expect(preference.back_urls).toEqual({
          success: "https://tienda1.landaetastudio.com/checkout/success",
          failure: "https://tienda1.landaetastudio.com/checkout/failure",
          pending: "https://tienda1.landaetastudio.com/checkout/pending",
        });
        expect(preference.external_reference).toBe(`${TENANT_ID}:${ORDER_ID}`);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Shipping details", () => {
    it("should return 400 when shipping details are missing", async () => {
      mockRedisIncr.mockResolvedValue(1);
      const tx = makeTxMock({ select: [
        { data: [{ ...MOCK_ORDER, shippingDetails: null }], terminal: "limit" },
        { data: [] },
        { data: [] },
        { data: [] },
      ] });
      vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

      const res = await POST(mockReq("POST",{ orderId: ORDER_ID, customerEmail: CALLER_EMAIL }));

      expect(res.status).toBe(400);
      expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    });
  });
});

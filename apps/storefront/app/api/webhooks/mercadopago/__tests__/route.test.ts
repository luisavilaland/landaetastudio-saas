import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

vi.mock("@/lib/email", () => ({
  sendOrderConfirmationEmail: vi.fn(),
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

import { NextRequest } from "next/server";
import { withTenantContext } from "@repo/db";
import { POST } from "../route";

const WEBHOOK_SECRET = "test-webhook-secret";
const ACCESS_TOKEN = "TEST-98765_test_access_token";
const RAW_BODY = JSON.stringify({ type: "payment", data: { id: "123456789" } });

const TENANT_ID = "tenant-123";

function makeTxMock() {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    execute: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeWebhookRequest(
  rawBody: string,
  overrides?: {
    signature?: string;
    requestId?: string;
    testOrderId?: string;
  }
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });

  const requestId = overrides?.requestId || null;
  const dataToSign = requestId ? `${rawBody}.${requestId}` : rawBody;
  const signature = overrides?.signature ?? crypto.createHmac("sha256", WEBHOOK_SECRET).update(dataToSign).digest("hex");

  headers.set("x-signature", signature);
  if (requestId) {
    headers.set("x-request-id", requestId);
  }
  if (overrides?.testOrderId) {
    headers.set("x-test-order-id", overrides.testOrderId);
  }

  return {
    text: async () => rawBody,
    json: async () => JSON.parse(rawBody),
    headers,
    nextUrl: new URL("http://localhost"),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

describe("POST /api/webhooks/mercadopago — HMAC verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.MERCADOPAGO_ACCESS_TOKEN = ACCESS_TOKEN;
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    vi.unstubAllEnvs();
  });

  it("should return 503 when webhook secret is not configured", async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

    const res = await POST(makeWebhookRequest(RAW_BODY));

    expect(res.status).toBe(503);
  });

  it("should return 401 when signature header is missing", async () => {
    const req = {
      text: async () => RAW_BODY,
      json: async () => JSON.parse(RAW_BODY),
      headers: new Headers({ "content-type": "application/json" }),
      nextUrl: new URL("http://localhost"),
      cookies: { get: vi.fn() },
    } as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("should return 401 when signature is invalid", async () => {
    const res = await POST(makeWebhookRequest(RAW_BODY, { signature: "invalid-signature-value" }));

    expect(res.status).toBe(401);
  });

  it("should return 200 when signature is valid (no x-request-id)", async () => {
    const res = await POST(makeWebhookRequest(RAW_BODY));

    expect(res.status).toBe(200);
  });

  it("should verify signature when x-request-id is present", async () => {
    const res = await POST(makeWebhookRequest(RAW_BODY, { requestId: "req-abc-123" }));

    expect(res.status).toBe(200);
  });

  it("should reject when signature is wrong with x-request-id", async () => {
    const res = await POST(
      makeWebhookRequest(RAW_BODY, { requestId: "req-abc-123", signature: "totally-wrong" })
    );

    expect(res.status).toBe(401);
  });
});

describe("POST /api/webhooks/mercadopago — Dev mode payment processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.MERCADOPAGO_ACCESS_TOKEN = ACCESS_TOKEN;
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    vi.unstubAllEnvs();
  });

  it("should approve payment with magic ID 123456789", async () => {
    const mockTx = makeTxMock();
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: "order-dev-123", customerEmail: "buyer@test.com", total: 10000,
        shippingDetails: { name: "Test Buyer" }, metadata: null,
      }]),
    } as any);
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(mockTx));

    const body = JSON.stringify({ type: "payment", data: { id: "123456789" } });
    const res = await POST(makeWebhookRequest(body, { testOrderId: `${TENANT_ID}:order-dev-123` }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ received: true });
    expect(withTenantContext).toHaveBeenCalled();
  });

  it("should reject payment with magic ID 000000", async () => {
    const mockTx = makeTxMock();
    mockTx.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ status: "pending_payment" }]),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "item-1", productVariantId: "var-1", quantity: 2 }]),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ stock: 10 }]),
      } as any);
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(mockTx));

    const body = JSON.stringify({ type: "payment", data: { id: "000000" } });
    const res = await POST(makeWebhookRequest(body, { testOrderId: `${TENANT_ID}:order-dev-123` }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ received: true });
    expect(withTenantContext).toHaveBeenCalled();
  });

  it("should return received when no orderId is provided for magic ID", async () => {
    const body = JSON.stringify({ type: "payment", data: { id: "123456789" } });
    const res = await POST(makeWebhookRequest(body));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("message", "No external_reference found");
  });
});

describe("POST /api/webhooks/mercadopago — Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERCADOPAGO_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.MERCADOPAGO_ACCESS_TOKEN = ACCESS_TOKEN;
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    vi.unstubAllEnvs();
  });

  it("should return 400 when payload has invalid structure", async () => {
    const res = await POST(makeWebhookRequest(JSON.stringify({ type: "payment" })));

    expect(res.status).toBe(400);
  });

  it("should return 400 when payment id is missing from data", async () => {
    const res = await POST(makeWebhookRequest(JSON.stringify({ type: "payment", data: {} })));

    expect(res.status).toBe(400);
  });
});

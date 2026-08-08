import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tenant", () => ({
  getTenantId: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  safeGet: vi.fn(),
  redisDel: vi.fn(),
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

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { withTenantContext } from "@repo/db";
import { makeTxMock, mockReq } from "@repo/test-utils";
import { cookies } from "next/headers";
import { safeGet, redisDel } from "@/lib/redis";
import { getTenantId } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { POST } from "../route";

const TENANT_ID = "tenant-123";
const CROSS_TENANT_ID = "tenant-b";
const SESSION_ID = "session-abc-123";
const VARIANT_ID = "variant-1";

const MOCK_CART = {
  items: [{ variantId: VARIANT_ID, quantity: 2, addedAt: new Date().toISOString() }],
  updatedAt: new Date().toISOString(),
};

const MOCK_EMPTY_CART = {
  items: [],
  updatedAt: new Date().toISOString(),
};

const MOCK_VARIANT = {
  id: VARIANT_ID,
  tenantId: TENANT_ID,
  productId: "product-1",
  sku: "SKU-001",
  price: 1999,
  stock: 10,
};

const MOCK_SHIPPING_METHOD = {
  id: "method-1",
  tenantId: TENANT_ID,
  name: "Envío estándar",
  description: "3 a 5 días",
  price: 500,
  freeShippingThreshold: null,
  isActive: "true",
  estimatedDaysMin: 3,
  estimatedDaysMax: 5,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_ORDER = {
  id: "order-123",
  tenantId: TENANT_ID,
  total: 4498,
  status: "pending_payment",
  currency: "UYU",
  customerEmail: "test@test.com",
  shippingDetails: {
    name: "Juan Perez",
    email: "test@test.com",
    phone: "099123456",
    address: "Calle 123",
  },
  customerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupCookie(sessionId: string | undefined) {
  const mockCookieStore = { get: vi.fn() };
  vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
  mockCookieStore.get.mockImplementation((key: string) => {
    if (key === "cart_session_id" && sessionId) return { value: sessionId };
    return undefined;
  });
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID);
    vi.mocked(auth).mockRejectedValue(new Error("No session"));
  });

  it("debe devolver 401 cuando no hay cookie de carrito", async () => {
    setupCookie(undefined);

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Sesión de carrito no encontrada");
  });

  it("debe devolver 400 cuando el carrito está vacío en Redis", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(null);

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Carrito vacío o no encontrado");
  });

  it("debe devolver 400 cuando el carrito tiene items vacíos", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_EMPTY_CART));

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Carrito vacío");
  });

  it("debe devolver 400 cuando la validación Zod falla", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART));

    const res = await POST(mockReq("POST",{ email: "invalido" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validación fallida");
  });

  it("debe devolver 400 cuando no hay tenant", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART));
    vi.mocked(getTenantId).mockResolvedValue(null);

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Tenant no válido");
  });

  it("debe devolver 422 cross-tenant cuando las variantes no pertenecen al tenant", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART));
    vi.mocked(getTenantId).mockResolvedValue(CROSS_TENANT_ID);

    const tx = makeTxMock();
    tx.select.mockReturnValue(tx);
    tx.from.mockReturnValue(tx);
    tx.where.mockResolvedValue([]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
      })
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Stock insuficiente");
    expect(body.outOfStock).toContain(VARIANT_ID);
    expect(withTenantContext).toHaveBeenCalledWith(CROSS_TENANT_ID, expect.any(Function));
  });

  it("debe devolver 400 cuando el método de envío no coincide con el tenant", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART));

    const tx = makeTxMock();
    tx.select.mockReturnValueOnce(tx);
    tx.from.mockReturnValueOnce(tx);
    tx.where.mockResolvedValueOnce([MOCK_VARIANT]);
    tx.select.mockReturnValueOnce(tx);
    tx.from.mockReturnValueOnce(tx);
    tx.where.mockReturnValueOnce(tx);
    tx.limit.mockResolvedValueOnce([]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
        shippingMethodId: "method-nonexistent",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Método de envío inválido o inactivo");
  });

  it("debe crear la orden exitosamente en caso feliz con envío", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART));

    const tx = makeTxMock();
    const limitObj = { limit: vi.fn().mockResolvedValue([MOCK_SHIPPING_METHOD]) };
    const whereObj = { where: vi.fn().mockReturnValue(limitObj) };
    const fromObj = { from: vi.fn().mockReturnValue(whereObj) };
    tx.select.mockReturnValueOnce(tx);
    tx.from.mockReturnValueOnce(tx);
    tx.where.mockResolvedValueOnce([MOCK_VARIANT]);
    tx.select.mockReturnValueOnce(fromObj);
    tx.update.mockReturnValue(tx);
    tx.set.mockReturnValue(tx);
    tx.where.mockResolvedValue(undefined);
    tx.insert.mockReturnValue(tx);
    tx.values.mockReturnValue(tx);
    tx.returning.mockResolvedValue([MOCK_ORDER]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    vi.mocked(redisDel).mockResolvedValue(undefined);

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
        shippingMethodId: "method-1",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("orderId");
    expect(body.status).toBe("pending_payment");
    expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
  });

  it("debe crear la orden sin método de envío en caso feliz", async () => {
    setupCookie(SESSION_ID);
    vi.mocked(safeGet).mockResolvedValue(JSON.stringify(MOCK_CART));

    const tx = makeTxMock();
    tx.select.mockReturnValue(tx);
    tx.from.mockReturnValue(tx);
    tx.where.mockResolvedValueOnce([MOCK_VARIANT]);
    tx.where.mockResolvedValue(undefined);
    tx.update.mockReturnValue(tx);
    tx.set.mockReturnValue(tx);
    tx.insert.mockReturnValue(tx);
    tx.values.mockReturnValue(tx);
    tx.returning.mockResolvedValue([MOCK_ORDER]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    vi.mocked(redisDel).mockResolvedValue(undefined);

    const res = await POST(
      mockReq("POST",{
        email: "test@test.com",
        name: "Juan Perez",
        phone: "099123456",
        address: "Calle 123",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("orderId");
    expect(body.total).toBe(4498);
    expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
  });
});

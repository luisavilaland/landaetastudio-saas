import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Product, ProductVariant } from "@repo/db";
import { db } from "@repo/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, db: { transaction: vi.fn() } };
});

import { auth } from "@/lib/auth";
import { GET, POST } from "../route";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PRODUCT_ID = "product-123";
const NOW = new Date("2025-01-01T00:00:00.000Z");

const baseProduct: Product = {
  id: PRODUCT_ID,
  tenantId: TENANT_A,
  categoryId: null,
  name: "Test Product",
  slug: "test-product",
  description: null,
  imageUrl: null,
  status: "active",
  metadata: {},
  createdAt: NOW,
  updatedAt: NOW,
};

const baseVariant: ProductVariant = {
  id: "variant-123",
  tenantId: TENANT_A,
  productId: PRODUCT_ID,
  sku: "test-product",
  price: 1999,
  stock: 10,
  options: {},
  createdAt: NOW,
  updatedAt: NOW,
};

function makeSelectChain<T>(value: T) {
  const promise = Promise.resolve(value);
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(value),
    orderBy: vi.fn().mockResolvedValue(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  } as unknown as ReturnType<typeof db.select>;
}

function makeTxMock() {
  return {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{}]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

function mockReq(method: string, body?: Record<string, unknown>) {
  const headers = new Headers();
  if (body) headers.set("content-type", "application/json");
  return {
    method,
    headers,
    json: async () => body,
    nextUrl: new URL("http://localhost"),
  } as unknown as Parameters<typeof GET>[0];
}

function session(tenantId: string, email: string) {
  return { user: { tenantId, email }, expires: "2099-01-01T00:00:00.000Z" };
}

// ──────── GET ────────

describe("GET /api/products/[id]/variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 sin sesión", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(401);
  });

  it("404 cross-tenant", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, "admin@b.com"));

    const mockTx = makeTxMock();
    mockTx.select.mockReturnValueOnce(makeSelectChain([]));
    vi.mocked(db.transaction).mockImplementation(async (cb: Function) => cb(mockTx));

    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
  });

  it("200 feliz", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));

    const mockTx = makeTxMock();
    mockTx.select
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]));
    vi.mocked(db.transaction).mockImplementation(async (cb: Function) => cb(mockTx));

    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.variants).toHaveLength(1);
    expect(data.variants[0].sku).toBe("test-product");
  });
});

// ──────── POST ────────

describe("POST /api/products/[id]/variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 sin sesión", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(mockReq("POST", { variants: [{ price: 1999, stock: 5 }] }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("404 cross-tenant", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, "admin@b.com"));

    const mockTx = makeTxMock();
    mockTx.select.mockReturnValueOnce(makeSelectChain([]));
    vi.mocked(db.transaction).mockImplementation(async (cb: Function) => cb(mockTx));

    const res = await POST(mockReq("POST", { variants: [{ price: 1999, stock: 5 }] }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("400 validación falla", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));

    const mockTx = makeTxMock();
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseProduct]));
    vi.mocked(db.transaction).mockImplementation(async (cb: Function) => cb(mockTx));

    const res = await POST(mockReq("POST", { variants: [{ price: -1, stock: 5 }] }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("200 feliz upsert de variantes", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));

    const mockTx = makeTxMock();
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseProduct]));
    mockTx.select.mockReturnValueOnce(makeSelectChain([]));
    mockTx.select.mockReturnValueOnce(makeSelectChain([baseVariant]));
    vi.mocked(db.transaction).mockImplementation(async (cb: Function) => cb(mockTx));

    const res = await POST(mockReq("POST", { variants: [{ price: 2999, stock: 20 }] }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.variants).toHaveLength(1);
  });

  it("409 violación FK (variante tiene órdenes)", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));

    vi.mocked(db.transaction).mockImplementation(async () => {
      const err = new Error("SQL foreign key violation");
      (err as any).code = "23503";
      throw err;
    });

    const res = await POST(mockReq("POST", { variants: [{ price: 2999, stock: 20 }] }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    });
    expect(res.status).toBe(409);
  });
});

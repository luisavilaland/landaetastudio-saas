import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Product, ProductVariant, ProductImage } from "@repo/db";
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

vi.mock("@repo/storage", () => ({
  uploadImage: vi.fn().mockResolvedValue("https://cdn.example.com/img.png"),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    db: {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

import { auth } from "@/lib/auth";
import { GET, PUT, DELETE } from "../route";

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

const baseImage: ProductImage = {
  id: "image-123",
  productId: PRODUCT_ID,
  tenantId: TENANT_A,
  url: "https://cdn.example.com/img.png",
  alt: null,
  position: 0,
  createdAt: NOW,
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
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn(),
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

describe("GET /api/products/[id]", () => {
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
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));
    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
  });

  it("200 feliz con variant e images", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]))
      .mockReturnValueOnce(makeSelectChain([baseImage]));
    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(PRODUCT_ID);
    expect(data.name).toBe("Test Product");
    expect(data.variant).toBeDefined();
    expect(data.images).toHaveLength(1);
  });
});

// ──────── PUT ────────

describe("PUT /api/products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 sin sesión", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PUT(mockReq("PUT", { name: "X" }), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(401);
  });

  it("404 cross-tenant", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, "admin@b.com"));
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));
    const res = await PUT(mockReq("PUT", { name: "X" }), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
  });

  it("400 validación Zod falla", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([baseProduct]));
    const res = await PUT(mockReq("PUT", { price: -1 }), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(400);
  });

  it("409 slug duplicado", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([{ ...baseProduct, id: "other" }]));
    const res = await PUT(mockReq("PUT", { slug: "other-slug" }), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.field).toBe("slug");
  });

  it("409 SKU duplicado al regenerar por slug change", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));
    const variantWithOptions: ProductVariant = {
      ...baseVariant,
      options: { color: "rojo" },
      sku: "test-product-rojo",
    };
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([]))                  // slug uniqueness — ok
      .mockReturnValueOnce(makeSelectChain([variantWithOptions])) // existing variants
      .mockReturnValueOnce(makeSelectChain([{ ...variantWithOptions, id: "other-variant" }])); // SKU dup
    const res = await PUT(mockReq("PUT", { slug: "new-slug" }), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.field).toBe("sku");
  });

  it("200 feliz", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));

    // Pre-transaction queries
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]));

    // Transaction mock
    vi.mocked(db.transaction).mockImplementation(async (cb: Function) => {
      await cb(makeTxMock());
    });

    // Post-transaction queries (updated product fetch)
    const updatedProduct = { ...baseProduct, name: "Updated Product" };
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([updatedProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]));

    const res = await PUT(mockReq("PUT", { name: "Updated Product" }), {
      params: Promise.resolve({ id: PRODUCT_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Product");
    expect(data.variant).toBeDefined();
  });
});

// ──────── DELETE ────────

describe("DELETE /api/products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 sin sesión", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(mockReq("DELETE"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(401);
  });

  it("404 cross-tenant", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_B, "admin@b.com"));
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]));
    const res = await DELETE(mockReq("DELETE"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
  });

  it("204 feliz", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A, "admin@a.com"));
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([baseProduct]))
      .mockReturnValueOnce(makeSelectChain([baseVariant]))
      .mockReturnValueOnce(makeSelectChain([]));
    vi.mocked(db.transaction).mockImplementation(async (cb: Function) => {
      await cb(makeTxMock());
    });
    const res = await DELETE(mockReq("DELETE"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(204);
  });
});

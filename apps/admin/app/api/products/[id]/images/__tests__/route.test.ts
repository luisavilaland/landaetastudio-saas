import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("@repo/storage", () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, withTenantContext: vi.fn() };
});

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@repo/db";
import { uploadImage, deleteImage } from "@repo/storage";
import { GET, POST } from "../route";
import { DELETE } from "../[imageId]/route";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PRODUCT_ID = "prod-1";
const PRODUCT_SLUG = "test-product";
const IMAGE_ID = "img-1";

function session(tenantId: string) {
  return { user: { tenantId, id: "user-1", email: "admin@test.com" }, expires: "2099-01-01" };
}

function makeRequest(method: string, url: string, formData?: FormData): NextRequest {
  return {
    json: async () => ({}),
    text: async () => "",
    formData: async () => formData ?? new FormData(),
    headers: new Headers({ "content-type": formData ? "multipart/form-data" : "application/json" }),
    nextUrl: new URL(url),
    method,
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

function makeTxMock() {
  return { select: vi.fn(), insert: vi.fn(), delete: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), returning: vi.fn(), values: vi.fn() } as any;
}

function setupTxSelect(data: any[]) {
  const tx = makeTxMock();
  tx.select.mockReturnValue(tx);
  tx.from.mockReturnValue(tx);
  tx.where.mockReturnValue(tx);
  tx.limit.mockResolvedValue(data);
  return tx;
}

function setupTxInsert(returningData: any[]) {
  const tx = makeTxMock();
  tx.insert.mockReturnValue(tx);
  tx.values.mockReturnValue(tx);
  tx.returning.mockResolvedValue(returningData);
  return tx;
}

describe("GET /api/products/[id]/images", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("GET", "http://localhost/api/products/prod-1/images"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when product not found", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = setupTxSelect([]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await GET(makeRequest("GET", "http://localhost/api/products/prod-1/images"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
    expect(withTenantContext).toHaveBeenCalledWith(TENANT_A, expect.any(Function));
  });

  it("should return images when product exists", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = makeTxMock();
    tx.select.mockReturnValue(tx);
    tx.from.mockReturnValue(tx);
    tx.where.mockReturnValue(tx);
    tx.limit.mockResolvedValueOnce([{ id: PRODUCT_ID, tenantId: TENANT_A }]);
    tx.orderBy.mockResolvedValueOnce([{ id: IMAGE_ID, productId: PRODUCT_ID, url: "http://img.url", position: 0 }]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await GET(makeRequest("GET", "http://localhost/api/products/prod-1/images"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toHaveLength(1);
  });
});

describe("POST /api/products/[id]/images", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("POST", "http://localhost/api/products/prod-1/images"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when product not found", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = setupTxSelect([]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await POST(makeRequest("POST", "http://localhost/api/products/prod-1/images"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
    expect(withTenantContext).toHaveBeenCalledWith(TENANT_A, expect.any(Function));
  });

  it("should return 400 when no image provided", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = setupTxSelect([{ id: PRODUCT_ID, tenantId: TENANT_A, slug: PRODUCT_SLUG, name: "Test" }]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await POST(makeRequest("POST", "http://localhost/api/products/prod-1/images"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(400);
  });

  it("should upload image and return 201", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    vi.mocked(uploadImage).mockResolvedValue("http://minio/img.png");

    const productTx = setupTxSelect([{ id: PRODUCT_ID, tenantId: TENANT_A, slug: PRODUCT_SLUG, name: "Test Product" }]);
    const insertTx = makeTxMock();
    insertTx.select.mockReturnValue(insertTx);
    insertTx.from.mockReturnValue(insertTx);
    insertTx.where.mockReturnValue(insertTx);
    insertTx.orderBy.mockResolvedValue([]);
    insertTx.insert.mockReturnValue(insertTx);
    insertTx.values.mockReturnValue(insertTx);
    insertTx.returning.mockResolvedValue([{ id: IMAGE_ID, productId: PRODUCT_ID, url: "http://minio/img.png", position: 0 }]);

    const mockCalls = [productTx, insertTx];
    let callIndex = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(mockCalls[callIndex++]));

    const fd = new FormData();
    fd.append("image", new File(["data"], "test.png", { type: "image/png" }));
    const res = await POST(makeRequest("POST", "http://localhost/api/products/prod-1/images", fd), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(res.status).toBe(201);
    expect(withTenantContext).toHaveBeenCalledTimes(2);
  });

  it("should return 409 when FK violation on insert (product deleted between contexts)", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    vi.mocked(uploadImage).mockResolvedValue("http://minio/img.png");

    const productTx = setupTxSelect([{ id: PRODUCT_ID, tenantId: TENANT_A, slug: PRODUCT_SLUG, name: "Test Product" }]);
    const insertTx = makeTxMock();
    insertTx.select.mockReturnValue(insertTx);
    insertTx.from.mockReturnValue(insertTx);
    insertTx.where.mockReturnValue(insertTx);
    insertTx.orderBy.mockResolvedValue([]);
    insertTx.insert.mockReturnValue(insertTx);
    insertTx.values.mockReturnValue(insertTx);
    insertTx.returning.mockRejectedValue({ code: "23503" });

    const mockCalls = [productTx, insertTx];
    let callIndex = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(mockCalls[callIndex++]));

    const fd = new FormData();
    fd.append("image", new File(["data"], "test.png", { type: "image/png" }));
    const res = await POST(makeRequest("POST", "http://localhost/api/products/prod-1/images", fd), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Producto no encontrado");
  });
});

describe("DELETE /api/products/[id]/images/[imageId]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE", "http://localhost/api/products/prod-1/images/img-1"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when image not found", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = setupTxSelect([]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await DELETE(makeRequest("DELETE", "http://localhost/api/products/prod-1/images/img-1"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });
    expect(res.status).toBe(404);
  });

  it("should return 404 when image belongs to different product", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = setupTxSelect([{ id: IMAGE_ID, tenantId: TENANT_A, productId: "other-prod", url: "http://img.url" }]);
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await DELETE(makeRequest("DELETE", "http://localhost/api/products/prod-1/images/img-1"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });
    expect(res.status).toBe(404);
  });

  it("should delete image and return 200", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    vi.mocked(deleteImage).mockResolvedValue(undefined);

    const readTx = setupTxSelect([{ id: IMAGE_ID, tenantId: TENANT_A, productId: PRODUCT_ID, url: "http://minio/products/prod-1/img.png" }]);
    const deleteTx = makeTxMock();
    deleteTx.delete.mockReturnValue(deleteTx);
    deleteTx.where.mockResolvedValue(undefined);

    const mockCalls = [readTx, deleteTx];
    let callIndex = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(mockCalls[callIndex++]));

    const res = await DELETE(makeRequest("DELETE", "http://localhost/api/products/prod-1/images/img-1"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });

    expect(res.status).toBe(200);
    expect(deleteImage).toHaveBeenCalled();
    expect(withTenantContext).toHaveBeenCalledTimes(2);
  });
});

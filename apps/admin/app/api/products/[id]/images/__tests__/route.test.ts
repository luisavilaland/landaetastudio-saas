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

import { withTenantContext } from "@repo/db";
import { makeTxMock, session, mockReq } from "@repo/test-utils";
import { auth } from "@/lib/auth";
import { uploadImage, deleteImage } from "@repo/storage";
import { GET, POST } from "../route";
import { DELETE } from "../[imageId]/route";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PRODUCT_ID = "prod-1";
const PRODUCT_SLUG = "test-product";
const IMAGE_ID = "img-1";

describe("GET /api/products/[id]/images", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when product not found", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = makeTxMock({ select: [{ data: [], terminal: "limit" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
    expect(withTenantContext).toHaveBeenCalledWith(TENANT_A, expect.any(Function));
  });

  it("should return images when product exists", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = makeTxMock({ select: [{ data: [{ id: PRODUCT_ID, tenantId: TENANT_A }], terminal: "limit" }, { data: [{ id: IMAGE_ID, productId: PRODUCT_ID, url: "http://img.url", position: 0 }], terminal: "orderBy" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await GET(mockReq("GET"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toHaveLength(1);
  });
});

describe("POST /api/products/[id]/images", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(mockReq("POST"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when product not found", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = makeTxMock({ select: [{ data: [], terminal: "limit" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await POST(mockReq("POST"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(404);
    expect(withTenantContext).toHaveBeenCalledWith(TENANT_A, expect.any(Function));
  });

  it("should return 400 when no image provided", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = makeTxMock({ select: [{ data: [{ id: PRODUCT_ID, tenantId: TENANT_A, slug: PRODUCT_SLUG, name: "Test" }], terminal: "limit" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await POST(mockReq("POST"), { params: Promise.resolve({ id: PRODUCT_ID }) });
    expect(res.status).toBe(400);
  });

  it("should upload image and return 201", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    vi.mocked(uploadImage).mockResolvedValue("http://minio/img.png");

    const productTx = makeTxMock({ select: [{ data: [{ id: PRODUCT_ID, tenantId: TENANT_A, slug: PRODUCT_SLUG, name: "Test Product" }], terminal: "limit" }] });
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
    const res = await POST(mockReq("POST", fd), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(res.status).toBe(201);
    expect(withTenantContext).toHaveBeenCalledTimes(2);
  });

  it("should return 409 when FK violation on insert (product deleted between contexts)", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    vi.mocked(uploadImage).mockResolvedValue("http://minio/img.png");

    const productTx = makeTxMock({ select: [{ data: [{ id: PRODUCT_ID, tenantId: TENANT_A, slug: PRODUCT_SLUG, name: "Test Product" }], terminal: "limit" }] });
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
    const res = await POST(mockReq("POST", fd), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Producto no encontrado");
  });
});

describe("DELETE /api/products/[id]/images/[imageId]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await DELETE(mockReq("DELETE"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when image not found", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = makeTxMock({ select: [{ data: [], terminal: "limit" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await DELETE(mockReq("DELETE"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });
    expect(res.status).toBe(404);
  });

  it("should return 404 when image belongs to different product", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    const tx = makeTxMock({ select: [{ data: [{ id: IMAGE_ID, tenantId: TENANT_A, productId: "other-prod", url: "http://img.url" }], terminal: "limit" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));
    const res = await DELETE(mockReq("DELETE"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });
    expect(res.status).toBe(404);
  });

  it("should delete image and return 200", async () => {
    vi.mocked(auth).mockResolvedValue(session(TENANT_A));
    vi.mocked(deleteImage).mockResolvedValue(undefined);

    const readTx = makeTxMock({ select: [{ data: [{ id: IMAGE_ID, tenantId: TENANT_A, productId: PRODUCT_ID, url: "http://minio/products/prod-1/img.png" }], terminal: "limit" }] });
    const deleteTx = makeTxMock();
    deleteTx.delete.mockReturnValue(deleteTx);
    deleteTx.where.mockResolvedValue(undefined);

    const mockCalls = [readTx, deleteTx];
    let callIndex = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(mockCalls[callIndex++]));

    const res = await DELETE(mockReq("DELETE"), { params: Promise.resolve({ id: PRODUCT_ID, imageId: IMAGE_ID }) });

    expect(res.status).toBe(200);
    expect(deleteImage).toHaveBeenCalled();
    expect(withTenantContext).toHaveBeenCalledTimes(2);
  });
});

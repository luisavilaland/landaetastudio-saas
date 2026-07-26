import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTenantContext } from "@repo/db";
import { makeTxMock, session } from "@repo/test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, withTenantContext: vi.fn(), db: undefined };
});
vi.mock("@repo/storage", () => ({ deleteImage: vi.fn().mockResolvedValue(undefined) }));

import { auth } from "@/lib/auth";
import { DELETE } from "../route";

function makeReq() {
  return {
    json: async () => ({}),
    text: async () => "",
    headers: new Headers(),
    nextUrl: new URL("http://localhost"),
    url: "http://localhost",
    cookies: { get: vi.fn() },
    method: "DELETE",
  } as any;
}

const mockImage = {
  id: "img-1",
  productId: "prod-1",
  tenantId: "tenant-1",
  url: "https://storage.com/products/prod-1/image.jpg",
  alt: "Product image",
  position: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/products/[id]/images/[imageId]", () => {
  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await DELETE(makeReq(), { params: Promise.resolve({ id: "prod-1", imageId: "img-1" }) });

    expect(response.status).toBe(401);
  });

  it("should return 404 when image not found", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTxMock({ select: [{ data: [], terminal: "limit" }] }))
    );

    const response = await DELETE(makeReq(), { params: Promise.resolve({ id: "prod-1", imageId: "img-1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Imagen no encontrada");
  });

  it("should return 404 when image does not belong to product", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTxMock({ select: [{ data: [{ ...mockImage, productId: "other-prod" }], terminal: "limit" }] }))
    );

    const response = await DELETE(makeReq(), { params: Promise.resolve({ id: "prod-1", imageId: "img-1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Imagen no encontrada");
  });

  it("should delete image successfully", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    let callCount = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) => {
      callCount++;
      if (callCount === 1) {
        return cb(makeTxMock({ select: [{ data: [mockImage], terminal: "limit" }] }));
      }
      return cb(makeTxMock());
    });

    const { deleteImage } = await import("@repo/storage");

    const response = await DELETE(makeReq(), { params: Promise.resolve({ id: "prod-1", imageId: "img-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteImage).toHaveBeenCalledWith("products/prod-1/image.jpg");
  });
});

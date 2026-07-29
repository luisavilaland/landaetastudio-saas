import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTenantContext } from "@repo/db";

vi.mock("@/lib/tenant", () => ({ getTenantId: vi.fn() }));
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

import { getTenantId } from "@/lib/tenant";
import { GET } from "../route";

const mockProductRow = {
  id: "prod-1",
  name: "Laptop Gamer",
  slug: "laptop-gamer",
  description: "Laptop potente para gaming",
  imageUrl: "https://example.com/img.jpg",
  status: "active",
  createdAt: new Date("2025-01-01"),
};

const mockVariantRow = {
  id: "v1",
  productId: "prod-1",
  price: 50000,
  stock: 10,
  sku: "LAP-001",
  options: { color: "negro" },
};

const mockImageRow = {
  id: "img1",
  productId: "prod-1",
  url: "https://example.com/img.jpg",
  alt: "Laptop Gamer",
  position: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function makeSearchReq(q = "", limit = "10", offset = "0") {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);
  const url = new URL(`http://localhost?${params.toString()}`);
  return {
    url: url.toString(),
    headers: new Headers(),
    cookies: { get: vi.fn() },
    nextUrl: url,
    method: "GET",
  } as any;
}

function makeTx(mockProducts: any[], mockCount: number, mockVariants: any[], mockImages: any[]) {
  const tx: any = {};
  tx.select = vi.fn().mockReturnThis();
  tx.from = vi.fn().mockReturnThis();
  tx.leftJoin = vi.fn().mockReturnThis();
  tx.groupBy = vi.fn().mockReturnThis();
  tx.limit = vi.fn().mockReturnThis();
  tx.where = vi.fn()
    .mockReturnValueOnce(tx)
    .mockResolvedValueOnce([{ count: mockCount }])
    .mockResolvedValueOnce(mockVariants)
    .mockReturnValueOnce(tx);
  tx.orderBy = vi.fn()
    .mockReturnValueOnce(tx)
    .mockResolvedValueOnce(mockImages);
  tx.offset = vi.fn().mockResolvedValue(mockProducts);
  return tx;
}

describe("GET /api/search", () => {
  it("should return empty result when no tenantId", async () => {
    vi.mocked(getTenantId).mockResolvedValue(null);

    const response = await GET(makeSearchReq("laptop"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("should return empty result when query is empty", async () => {
    vi.mocked(getTenantId).mockResolvedValue("tenant-1");

    const response = await GET(makeSearchReq(""));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("should return products with details from search", async () => {
    vi.mocked(getTenantId).mockResolvedValue("tenant-1");
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTx([mockProductRow], 2, [mockVariantRow], [mockImageRow]))
    );

    const response = await GET(makeSearchReq("laptop"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].name).toBe("Laptop Gamer");
    expect(body.products[0].slug).toBe("laptop-gamer");
    expect(body.products[0].variants).toHaveLength(1);
    expect(body.products[0].variants[0].price).toBe(50000);
    expect(body.products[0].images).toHaveLength(1);
    expect(body.products[0].firstImage).toBeDefined();
    expect(body.products[0].priceRange).toEqual({ min: 50000, max: 50000 });
    expect(body.total).toBe(2);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it("should return empty products when no matches", async () => {
    vi.mocked(getTenantId).mockResolvedValue("tenant-1");
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTx([], 0, [], []))
    );

    const response = await GET(makeSearchReq("inexistente"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("should propagate pagination params", async () => {
    vi.mocked(getTenantId).mockResolvedValue("tenant-1");
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTx([mockProductRow], 1, [mockVariantRow], [mockImageRow]))
    );

    const response = await GET(makeSearchReq("laptop", "5", "10"));
    const body = await response.json();

    expect(body.limit).toBe(5);
    expect(body.offset).toBe(10);
  });

  it("should cap limit at 50", async () => {
    vi.mocked(getTenantId).mockResolvedValue("tenant-1");
    vi.mocked(withTenantContext).mockImplementation(async (_tid, cb) =>
      cb(makeTx([], 0, [], []))
    );

    const response = await GET(makeSearchReq("laptop", "100"));
    const body = await response.json();

    expect(body.limit).toBe(50);
  });
});

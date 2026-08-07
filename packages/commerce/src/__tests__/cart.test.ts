import { describe, it, expect, vi, beforeEach } from "vitest";

function makeResolvableChain<T>(data: T[]) {
  const chain: Record<string, any> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: vi.fn((resolve: (val: T[]) => T[]) => resolve(data)),
  };
  return chain;
}

const mockRedisGet = vi.hoisted(() => vi.fn());
const mockRedisSetex = vi.hoisted(() => vi.fn());
const mockRedisDel = vi.hoisted(() => vi.fn());

vi.mock("../redis", () => ({
  safeGet: mockRedisGet,
  redisSetEx: mockRedisSetex,
  redisDel: mockRedisDel,
}));

const mockTxSelect = vi.hoisted(() => vi.fn());
const mockDbProducts = vi.hoisted(() => ({}));
const mockDbProductVariants = vi.hoisted(() => ({}));
const mockDbProductImages = vi.hoisted(() => ({}));

vi.mock("@repo/db", () => ({
  db: {},
  withTenantContext: vi.fn(async (_tenantId: string, cb: (tx: any) => any) =>
    cb({ select: mockTxSelect })
  ),
  dbProducts: mockDbProducts,
  dbProductVariants: mockDbProductVariants,
  dbProductImages: mockDbProductImages,
}));

import { getCart, removeFromCart } from "../cart";

const tenantId = "tenant-123";

describe("getCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when sessionId is empty", async () => {
    const result = await getCart("", tenantId);

    expect(result).toEqual([]);
    expect(mockRedisGet).not.toHaveBeenCalled();
  });

  it("should return empty array when tenantId is empty", async () => {
    const result = await getCart("session-1", "");

    expect(result).toEqual([]);
    expect(mockRedisGet).not.toHaveBeenCalled();
  });

  it("should return empty array when no cart data in redis", async () => {
    mockRedisGet.mockResolvedValue(null);

    const result = await getCart("session-1", tenantId);

    expect(result).toEqual([]);
  });

  it("should return empty array when cart has no items", async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({ items: [], updatedAt: new Date().toISOString() }),
    );

    const result = await getCart("session-empty", tenantId);

    expect(result).toEqual([]);
  });

  it("should return enriched items from cart data", async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({
        items: [{ variantId: "v1", quantity: 2, addedAt: "2026-01-01T00:00:00.000Z" }],
        updatedAt: new Date().toISOString(),
      }),
    );

    const variantChain = makeResolvableChain([
      {
        variantId: "v1",
        variantPrice: 1500,
        variantStock: 10,
        variantSku: "SKU-001",
        variantOptions: { color: "rojo" },
        productId: "p1",
        productName: "Producto 1",
        productSlug: "producto-1",
        productImage: "img.jpg",
      },
    ]);
    const imageChain = makeResolvableChain([
      { productId: "p1", url: "images/1.jpg" },
    ]);

    mockTxSelect.mockReturnValueOnce(variantChain).mockReturnValueOnce(imageChain);

    const result = await getCart("session-1", tenantId);

    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe("v1");
    expect(result[0].quantity).toBe(2);
    expect(result[0].product?.name).toBe("Producto 1");
    expect(result[0].product?.price).toBe(1500);
    expect(result[0].variant?.sku).toBe("SKU-001");
  });

  it("should skip variants not found in DB", async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({
        items: [
          { variantId: "v1", quantity: 1, addedAt: "2026-01-01T00:00:00.000Z" },
          { variantId: "v-missing", quantity: 1, addedAt: "2026-01-01T00:00:00.000Z" },
        ],
        updatedAt: new Date().toISOString(),
      }),
    );

    const variantChain = makeResolvableChain([
      {
        variantId: "v1",
        variantPrice: 500,
        variantStock: 5,
        variantSku: "SKU-001",
        variantOptions: {},
        productId: "p1",
        productName: "Solo existente",
        productSlug: "solo-existente",
        productImage: null,
      },
    ]);
    const imageChain = makeResolvableChain([]);

    mockTxSelect.mockReturnValueOnce(variantChain).mockReturnValueOnce(imageChain);

    const result = await getCart("session-1", tenantId);

    expect(result).toHaveLength(1);
    expect(result[0].product?.name).toBe("Solo existente");
  });
});

describe("removeFromCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should remove an item and update the cart", async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({
        items: [
          { variantId: "v1", quantity: 2, addedAt: "2026-01-01T00:00:00.000Z" },
          { variantId: "v2", quantity: 1, addedAt: "2026-01-01T00:00:00.000Z" },
        ],
        updatedAt: new Date().toISOString(),
      }),
    );

    const variantChain = makeResolvableChain([
      {
        variantId: "v1",
        variantPrice: 1500,
        variantStock: 10,
        variantSku: "SKU-001",
        variantOptions: {},
        productId: "p1",
        productName: "Producto 1",
        productSlug: "producto-1",
        productImage: null,
      },
    ]);
    const imageChain = makeResolvableChain([]);

    mockTxSelect.mockReturnValueOnce(variantChain).mockReturnValueOnce(imageChain);

    const result = await removeFromCart("session-1", "v2", tenantId);

    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe("v1");
  });

  it("should delete the cart key when last item is removed", async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({
        items: [{ variantId: "v1", quantity: 1, addedAt: "2026-01-01T00:00:00.000Z" }],
        updatedAt: new Date().toISOString(),
      }),
    );

    mockRedisDel.mockResolvedValue(1);

    const result = await removeFromCart("session-1", "v1", tenantId);

    expect(result).toEqual([]);
    expect(mockRedisDel).toHaveBeenCalledWith("cart:session-1");
    expect(mockRedisSetex).not.toHaveBeenCalled();
  });

  it("should return empty array when sessionId is empty", async () => {
    const result = await removeFromCart("", "v1", tenantId);

    expect(result).toEqual([]);
  });

  it("should return empty array when cart does not exist", async () => {
    mockRedisGet.mockResolvedValue(null);

    const result = await removeFromCart("session-nonexistent", "v1", tenantId);

    expect(result).toEqual([]);
  });
});

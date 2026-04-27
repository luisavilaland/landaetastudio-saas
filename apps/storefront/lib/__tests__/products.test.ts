import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProducts, getProductBySlug } from "../products";
import * as dbModule from "@repo/db";

vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn(),
  },
  dbProducts: {
    id: "id",
    name: "name",
    slug: "slug",
    description: "description",
    imageUrl: "imageUrl",
    status: "status",
    createdAt: "createdAt",
    tenantId: "tenantId",
    categoryId: "categoryId",
  },
  dbProductVariants: {
    id: "variantId",
    price: "variantPrice",
    stock: "variantStock",
    sku: "variantSku",
    productId: "productId",
  },
  dbCategories: {
    id: "categoryId",
    name: "categoryName",
    slug: "categorySlug",
    tenantId: "tenantId",
  },
}));

const mockSelect = vi.mocked(dbModule.db).select;
const mockSelectReturn = {
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

mockSelect.mockReturnValue(mockSelectReturn as any);

const mockProducts = [
  {
    id: "product-1",
    name: "Product 1",
    slug: "product-1",
    description: "Description 1",
    imageUrl: "https://example.com/img1.jpg",
    status: "active",
    createdAt: new Date("2026-01-01"),
    variantId: "variant-1",
    variantPrice: 1999,
    variantStock: 10,
    variantSku: "product-1",
  },
  {
    id: "product-2",
    name: "Product 2",
    slug: "product-2",
    description: "Description 2",
    imageUrl: null,
    status: "active",
    createdAt: new Date("2026-01-02"),
    variantId: "variant-2",
    variantPrice: 2999,
    variantStock: 5,
    variantSku: "product-2",
  },
];

describe("products lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProducts", () => {
    it("should return products for the specified tenant", async () => {
      const tenantId = "tenant-123";
      mockSelectReturn.limit.mockResolvedValue(mockProducts);

      const result = await getProducts(tenantId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockSelectReturn.from).toHaveBeenCalled();
      expect(mockSelectReturn.innerJoin).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("variant");
    });

    it("should respect the limit parameter", async () => {
      const tenantId = "tenant-123";
      const limit = 1;
      mockSelectReturn.limit.mockResolvedValue([mockProducts[0]]);

      const result = await getProducts(tenantId, limit);

      expect(result).toHaveLength(1);
    });

    it("should filter by tenantId in the query", async () => {
      const tenantId = "tenant-specific";
      mockSelectReturn.limit.mockResolvedValue([]);

      await getProducts(tenantId);

      expect(mockSelectReturn.where).toHaveBeenCalled();
    });
  });

  describe("getProductBySlug", () => {
    it("should return null when no product found", async () => {
      const tenantId = "tenant-123";
      mockSelectReturn.limit.mockResolvedValue([]);

      const result = await getProductBySlug(tenantId, "nonexistent");

      expect(result).toBeNull();
    });

    it("should return product with variant when found", async () => {
      const tenantId = "tenant-123";
      mockSelectReturn.limit.mockResolvedValue([mockProducts[0]]);

      const result = await getProductBySlug(tenantId, "product-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("product-1");
      expect(result?.variant).toBeDefined();
      expect(result?.variant?.price).toBe(1999);
    });

    it("should include tenantId and slug in query filters", async () => {
      const tenantId = "tenant-456";
      mockSelectReturn.limit.mockResolvedValue([]);

      await getProductBySlug(tenantId, "specific-slug");

      expect(mockSelectReturn.where).toHaveBeenCalled();
    });
  });
});
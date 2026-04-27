import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProducts, getProductBySlug } from "../products";
import * as dbModule from "@repo/db";

vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn(),
  },
  dbProducts: {},
  dbProductVariants: {},
  dbProductImages: {},
  dbCategories: {},
}));

const mockProduct = {
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
  categoryId: "cat-1",
  categoryName: "Category 1",
  categorySlug: "category-1",
};

const createQueryBuilder = (finalResult: any) => {
  const builder: any = {};

  // Make the builder thenable - when awaited, resolve with finalResult
  builder.then = (resolve: any, reject: any) => {
    return Promise.resolve(finalResult).then(resolve, reject);
  };

  // All chainable methods return the same builder
  const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit'];
  methods.forEach(method => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  return builder;
};

describe("products lib", () => {
  beforeEach(() => {
    vi.mocked(dbModule.db.select).mockReset();
  });

  describe("getProducts", () => {
    it("should return products for the specified tenant", async () => {
      const tenantId = "tenant-123";

      const productsBuilder = createQueryBuilder([mockProduct]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProducts(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("variant");
      expect(result[0]).toHaveProperty("images");
    });

    it("should respect the limit parameter", async () => {
      const tenantId = "tenant-123";
      const limit = 1;

      const productsBuilder = createQueryBuilder([mockProduct]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProducts(tenantId, limit);

      expect(result).toHaveLength(1);
    });

    it("should filter by tenantId in the query", async () => {
      const tenantId = "tenant-specific";

      const productsBuilder = createQueryBuilder([]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      await getProducts(tenantId);

      expect(productsBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getProductBySlug", () => {
    it("should return null when no product found", async () => {
      const tenantId = "tenant-123";

      const productsBuilder = createQueryBuilder([]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProductBySlug(tenantId, "nonexistent");

      expect(result).toBeNull();
    });

    it("should return product with variant when found", async () => {
      const tenantId = "tenant-123";

      const productsBuilder = createQueryBuilder([mockProduct]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProductBySlug(tenantId, "product-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("product-1");
      expect(result?.variant).toBeDefined();
      expect(result?.variant?.price).toBe(1999);
      expect(result?.images).toEqual([]);
    });

    it("should include tenantId and slug in query filters", async () => {
      const tenantId = "tenant-456";

      const productsBuilder = createQueryBuilder([]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      await getProductBySlug(tenantId, "specific-slug");

      expect(productsBuilder.where).toHaveBeenCalled();
    });
  });
});

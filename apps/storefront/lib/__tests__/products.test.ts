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
  inArray: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
}));

const mockProduct = {
  id: "product-1",
  name: "Product 1",
  slug: "product-1",
  description: "Description 1",
  imageUrl: "https://example.com/img1.jpg",
  status: "active",
  createdAt: new Date("2026-01-01"),
  categoryId: "cat-1",
  categoryName: "Category 1",
  categorySlug: "category-1",
};

const mockVariants = [
  {
    id: "variant-1",
    price: 1999,
    stock: 10,
    sku: "product-1-s",
    options: { Talle: "S" },
  },
  {
    id: "variant-2",
    price: 1999,
    stock: 5,
    sku: "product-1-m",
    options: { Talle: "M" },
  },
];

const mockImages = [
  { id: "img-1", url: "https://example.com/img1.jpg", alt: "Image 1", position: 0 },
];

const createQueryBuilder = (finalResult: any) => {
  const builder: any = {};

  builder.then = (resolve: any, reject: any) => {
    return Promise.resolve(finalResult).then(resolve, reject);
  };

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
      const variantsBuilder = createQueryBuilder(mockVariants);
      const imagesBuilder = createQueryBuilder(mockImages);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(variantsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProducts(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("variants");
      expect(result[0]).toHaveProperty("images");
      expect(Array.isArray(result[0].variants)).toBe(true);
    });

    it("should respect the limit parameter", async () => {
      const tenantId = "tenant-123";
      const limit = 1;

      const productsBuilder = createQueryBuilder([mockProduct]);
      const variantsBuilder = createQueryBuilder(mockVariants);
      const imagesBuilder = createQueryBuilder(mockImages);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(variantsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProducts(tenantId, limit);

      expect(result).toHaveLength(1);
    });

    it("should filter by tenantId in the query", async () => {
      const tenantId = "tenant-specific";

      const productsBuilder = createQueryBuilder([]);
      const variantsBuilder = createQueryBuilder([]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(variantsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      await getProducts(tenantId);

      expect(productsBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getProductBySlug", () => {
    it("should return null when no product found", async () => {
      const tenantId = "tenant-123";

      const productsBuilder = createQueryBuilder([]);
      const variantsBuilder = createQueryBuilder([]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(variantsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProductBySlug(tenantId, "nonexistent");

      expect(result).toBeNull();
    });

    it("should return product with variants when found", async () => {
      const tenantId = "tenant-123";

      const productsBuilder = createQueryBuilder([mockProduct]);
      const variantsBuilder = createQueryBuilder(mockVariants);
      const imagesBuilder = createQueryBuilder(mockImages);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(variantsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      const result = await getProductBySlug(tenantId, "product-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("product-1");
      expect(result?.variants).toBeDefined();
      expect(Array.isArray(result?.variants)).toBe(true);
      expect(result?.variants.length).toBe(2);
      expect(result?.variants[0].price).toBe(1999);
      expect(result?.images).toEqual(mockImages);
    });

    it("should include tenantId and slug in query filters", async () => {
      const tenantId = "tenant-456";

      const productsBuilder = createQueryBuilder([]);
      const variantsBuilder = createQueryBuilder([]);
      const imagesBuilder = createQueryBuilder([]);

      vi.mocked(dbModule.db.select)
        .mockReturnValueOnce(productsBuilder as any)
        .mockReturnValueOnce(variantsBuilder as any)
        .mockReturnValueOnce(imagesBuilder as any);

      await getProductBySlug(tenantId, "specific-slug");

      expect(productsBuilder.where).toHaveBeenCalled();
    });
  });
});

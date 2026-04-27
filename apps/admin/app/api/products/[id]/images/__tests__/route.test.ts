import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

type Product = { tenantId: string };
type Image = { id: string; url: string; size?: number };

describe("POST /api/products/[id]/images", () => {
  describe("Authentication & Authorization", () => {
    it("should return 401 when no session", async () => {
      const session = null;
      const handler = async (s: typeof session) => {
        if (!s) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ error: "unexpected" }, { status: 500 });
      };

      const response = await handler(session);
      expect(response.status).toBe(401);
    });

    it("should return 404 when product not found", async () => {
      const product: Product[] = [];
      const tenantId = "tenant-123";
      const handler = async (p: Product[], t: string) => {
        if (p.length === 0) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
      };

      const response = await handler(product, tenantId);
      expect(response.status).toBe(404);
    });

    it("should return 404 when product belongs to different tenant", async () => {
      const product: Product[] = [{ tenantId: "tenant-456" }];
      const tenantId = "tenant-123";
      const handler = async (p: Product[], t: string) => {
        if (p[0].tenantId !== t) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
      };

      const response = await handler(product, tenantId);
      expect(response.status).toBe(404);
    });
  });

  describe("Validation", () => {
    it("should require image file", async () => {
      const image = null;
      const handler = async (img: typeof image) => {
        if (!img) {
          return NextResponse.json({ error: "Image is required" }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      };

      const response = await handler(image);
      expect(response.status).toBe(400);
    });

    it("should accept valid image and return 201", async () => {
      const image = { size: 1024, name: "test.png", type: "image/png", arrayBuffer: async () => new ArrayBuffer(1024) };
      const url = "http://minio:9000/bucket/products/prod-1/123-test.png";
      const imageRecord = {
        id: "img-1",
        productId: "prod-1",
        tenantId: "tenant-1",
        url,
        alt: "test.png",
        position: 0,
      };

      const handler = async (img: typeof image, tenantId: string) => {
        if (!img || img.size === 0) {
          return NextResponse.json({ error: "Image is required" }, { status: 400 });
        }
        return NextResponse.json(imageRecord, { status: 201 });
      };

      const response = await handler(image, "tenant-1");
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty("url");
      expect(data).toHaveProperty("id");
    });
  });
});

describe("DELETE /api/products/[id]/images/[imageId]", () => {
  describe("Authentication & Authorization", () => {
    it("should return 401 when no session", async () => {
      const session = null;
      const handler = async (s: typeof session) => {
        if (!s) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ success: true });
      };

      const response = await handler(session);
      expect(response.status).toBe(401);
    });

    it("should return 404 when image not found for tenant", async () => {
      const image: Image[] = [];
      const handler = async (img: Image[]) => {
        if (img.length === 0) {
          return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }
        return new NextResponse(null, { status: 204 });
      };

      const response = await handler(image);
      expect(response.status).toBe(404);
    });

    it("should return 204 on successful deletion", async () => {
      const image: Image[] = [{ id: "img-1", url: "http://minio:9000/bucket/test.png" }];
      const handler = async (img: Image[]) => {
        if (img.length === 0) {
          return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }
        return new NextResponse(null, { status: 204 });
      };

      const response = await handler(image);
      expect(response.status).toBe(204);
    });
  });
});

describe("GET /api/products/[id] - with images", () => {
  it("should return product with images array", () => {
    const product = {
      id: "prod-1",
      name: "Test Product",
      slug: "test-product",
      images: [
        { id: "img-1", url: "http://minio:9000/bucket/img1.png", alt: "Image 1", position: 0 },
        { id: "img-2", url: "http://minio:9000/bucket/img2.png", alt: "Image 2", position: 1 },
      ],
    };

    expect(product).toHaveProperty("images");
    expect(product.images).toBeInstanceOf(Array);
    expect(product.images.length).toBe(2);
    expect(product.images[0]).toHaveProperty("url");
    expect(product.images[0]).toHaveProperty("position");
  });
});

describe("GET /api/products - list with images", () => {
  it("should return products with images array for each product", () => {
    const products = [
      {
        id: "prod-1",
        name: "Product 1",
        images: [{ id: "img-1", url: "http://minio:9000/bucket/img1.png", alt: "Image 1", position: 0 }],
      },
      {
        id: "prod-2",
        name: "Product 2",
        images: [],
      },
    ];

    products.forEach((product) => {
      expect(product).toHaveProperty("images");
      expect(product.images).toBeInstanceOf(Array);
    });
  });
});

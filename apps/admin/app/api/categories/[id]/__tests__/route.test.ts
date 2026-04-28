import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Mock NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Create chainable mock helpers
const createSelectChain = (result: any[]) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(result),
});

const createUpdateChain = (result: any[]) => ({
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue(result),
});

// Mock db
vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  dbCategories: {},
  dbProducts: {},
}));

describe("PUT /api/categories/[id]", () => {
  describe("Slug regeneration", () => {
    it("should regenerate slug when name changes", async () => {
      const { PUT } = await import("../route");
      const { auth } = await import("@/lib/auth");
      const { db } = await import("@repo/db");

      const mockCategory = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Shorts",
        slug: "shorts",
      };

      const mockSession = {
        user: { tenantId: "tenant-1" },
      };

      vi.mocked(auth).mockResolvedValueOnce(mockSession as any);

      // First select: get existing category
      vi.mocked(db.select).mockReturnValueOnce(createSelectChain([mockCategory]));

      // Second select: check duplicate slug (none found)
      vi.mocked(db.select).mockReturnValueOnce(createSelectChain([]));

      // Update returning
      vi.mocked(db.update).mockReturnValueOnce(
        createUpdateChain([
          {
            ...mockCategory,
            name: "Short",
            slug: "short",
            updatedAt: new Date(),
          },
        ])
      );

      const request = {
        json: async () => ({ name: "Short", slug: undefined }),
      };

      const params = Promise.resolve({ id: "cat-1" });
      const response = await PUT(request as any, { params });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.category).toBeDefined();
      expect(body.category.slug).toBe("short");
    });

    it("should return 409 when regenerated slug already exists for tenant", async () => {
      const { PUT } = await import("../route");
      const { auth } = await import("@/lib/auth");
      const { db } = await import("@repo/db");

      const mockCategory = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Shorts",
        slug: "shorts",
      };

      const mockSession = {
        user: { tenantId: "tenant-1" },
      };

      vi.mocked(auth).mockResolvedValueOnce(mockSession as any);

      // First select: get existing category
      vi.mocked(db.select).mockReturnValueOnce(createSelectChain([mockCategory]));

      // Second select: check duplicate slug (found!)
      vi.mocked(db.select).mockReturnValueOnce(
        createSelectChain([{ id: "cat-2", slug: "short" }])
      );

      const request = {
        json: async () => ({ name: "Short", slug: undefined }),
      };

      const params = Promise.resolve({ id: "cat-1" });
      const response = await PUT(request as any, { params });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toContain("Slug already exists");
    });

    it("should keep provided slug if name doesn't change", async () => {
      const { PUT } = await import("../route");
      const { auth } = await import("@/lib/auth");
      const { db } = await import("@repo/db");

      const mockCategory = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Shorts",
        slug: "shorts",
      };

      const mockSession = {
        user: { tenantId: "tenant-1" },
      };

      vi.mocked(auth).mockResolvedValueOnce(mockSession as any);

      // First select: get existing category
      vi.mocked(db.select).mockReturnValueOnce(createSelectChain([mockCategory]));

      // Second select: check duplicate slug (none found)
      vi.mocked(db.select).mockReturnValueOnce(createSelectChain([]));

      // Update returning
      vi.mocked(db.update).mockReturnValueOnce(
        createUpdateChain([
          {
            ...mockCategory,
            slug: "custom-slug",
            updatedAt: new Date(),
          },
        ])
      );

      const request = {
        json: async () => ({ slug: "custom-slug" }),
      };

      const params = Promise.resolve({ id: "cat-1" });
      const response = await PUT(request as any, { params });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.category.slug).toBe("custom-slug");
    });
  });
});

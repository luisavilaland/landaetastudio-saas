import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

type Category = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  updatedAt?: Date;
};

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function handlePut(
  session: { user: { tenantId: string } } | null,
  existing: Category | null,
  body: { name?: string; slug?: string },
  duplicateSlug: Category | null = null
) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Determinar el slug final
  let finalSlug = body.slug;
  if (!finalSlug && body.name && body.name !== existing.name) {
    finalSlug = generateSlug(body.name);
  }
  if (!finalSlug) {
    finalSlug = existing.slug;
  }

  // Verificar duplicado de slug
  if (finalSlug !== existing.slug && duplicateSlug) {
    return NextResponse.json(
      { error: "Slug already exists for this tenant" },
      { status: 409 }
    );
  }

  const updated: Category = {
    ...existing,
    name: body.name ?? existing.name,
    slug: finalSlug,
    updatedAt: new Date(),
  };

  return NextResponse.json({ category: updated });
}

describe("PUT /api/categories/[id]", () => {
  describe("Slug regeneration", () => {
    it("should regenerate slug when name changes", async () => {
      const existing: Category = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Shorts",
        slug: "shorts",
      };

      const res = await handlePut(
        { user: { tenantId: "tenant-1" } },
        existing,
        { name: "Short", slug: undefined },
        null
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.category).toBeDefined();
      expect(body.category.slug).toBe("short");
    });

    it("should return 409 when regenerated slug already exists for tenant", async () => {
      const existing: Category = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Shorts",
        slug: "shorts",
      };

      const duplicate: Category = {
        id: "cat-2",
        tenantId: "tenant-1",
        name: "Short",
        slug: "short",
      };

      const res = await handlePut(
        { user: { tenantId: "tenant-1" } },
        existing,
        { name: "Short", slug: undefined },
        duplicate
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("Slug already exists");
    });

    it("should keep provided slug if name doesn't change", async () => {
      const existing: Category = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Shorts",
        slug: "shorts",
      };

      const res = await handlePut(
        { user: { tenantId: "tenant-1" } },
        existing,
        { slug: "custom-slug" },
        null
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.category.slug).toBe("custom-slug");
      expect(body.category.name).toBe("Shorts");
    });

    it("should return 401 when no session", async () => {
      const existing: Category = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Shorts",
        slug: "shorts",
      };

      const res = await handlePut(null, existing, { name: "Short" });
      expect(res.status).toBe(401);
    });

    it("should return 404 when category not found", async () => {
      const res = await handlePut(
        { user: { tenantId: "tenant-1" } },
        null,
        { name: "Short" }
      );
      expect(res.status).toBe(404);
    });

    it("should normalize slug with accents and uppercase", async () => {
      const existing: Category = {
        id: "cat-1",
        tenantId: "tenant-1",
        name: "Remeras",
        slug: "remeras",
      };

      const res = await handlePut(
        { user: { tenantId: "tenant-1" } },
        existing,
        { name: "Ñoños Ácidos" },
        null
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.category.slug).toBe("nonos-acidos");
    });
  });
});
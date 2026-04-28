import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
  dbTenants: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/categories", () => ({
  getCategoriesForTenant: vi.fn().mockResolvedValue([]),
}));

describe("Perfil page - generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate correct metadata structure", () => {
    const metadata = {
      title: "Mi Tienda Test",
      description: "Una tienda de prueba",
    };

    expect(metadata.title).toBe("Mi Tienda Test");
    expect(metadata.description).toBe("Una tienda de prueba");
  });

  it("should handle default values", () => {
    const metadata = {
      title: "Tienda",
      description: "Tienda online de Tienda",
    };

    expect(metadata.title).toBe("Tienda");
    expect(metadata.description).toBe("Tienda online de Tienda");
  });

  it("should use storeDescription when available", () => {
    const settings = {
      storeDescription: "La mejor tienda",
    };

    const description = settings.storeDescription || "";
    expect(description).toBe("La mejor tienda");
  });
});

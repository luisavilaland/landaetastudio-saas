import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTxSelect, mockFrom, mockWhere, mockOrderBy, mockCategories } = vi.hoisted(
  () => {
    const mockCategories = [
      { id: "cat-1", name: "Electrónicos", slug: "electronicos" },
      { id: "cat-2", name: "Ropa", slug: "ropa" },
    ];
    const mockOrderBy = vi.fn().mockResolvedValue(mockCategories);
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockTxSelect = vi.fn().mockReturnValue({ from: mockFrom });
    return { mockTxSelect, mockFrom, mockWhere, mockOrderBy, mockCategories };
  },
);

vi.mock("@repo/db", () => ({
  db: {},
  withTenantContext: vi.fn(async (_tenantId: string, cb: (tx: any) => any) =>
    cb({ select: mockTxSelect })
  ),
  dbCategories: {
    id: "id",
    name: "name",
    slug: "slug",
    tenantId: "tenantId",
  },
}));

import { getCategoriesForTenant } from "../categories";

describe("getCategoriesForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTxSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValue(mockCategories);
  });

  it("should return categories ordered by name for a given tenant", async () => {
    const result = await getCategoriesForTenant("tenant-1");

    expect(result).toEqual(mockCategories);
    expect(mockTxSelect).toHaveBeenCalledWith({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    });
  });

  it("should return an empty array when no categories exist", async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    const result = await getCategoriesForTenant("tenant-empty");

    expect(result).toEqual([]);
  });
});

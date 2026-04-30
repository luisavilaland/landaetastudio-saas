import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
  dbShippingMethods: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  asc: vi.fn(),
}));

import { headers } from "next/headers";
import { GET } from "../route";

const mockActiveMethods = [
  {
    id: "method-1",
    tenantId: "tenant-1",
    name: "Envío estándar",
    description: "3 a 5 días hábiles",
    price: 15000,
    freeShippingThreshold: 200000,
    estimatedDaysMin: 3,
    estimatedDaysMax: 5,
    isActive: "true",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "method-2",
    tenantId: "tenant-1",
    name: "Envío express",
    description: "24 horas hábiles",
    price: 35000,
    freeShippingThreshold: null,
    estimatedDaysMin: 1,
    estimatedDaysMax: 1,
    isActive: "true",
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockInactiveMethod = {
  ...mockActiveMethods[0],
  id: "method-3",
  isActive: "false",
};

describe("GET /api/shipping (storefront)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna métodos activos cuando hay tenantId en headers", async () => {
    const { db } = await import("@repo/db");
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => (key === "x-tenant-id" ? "tenant-1" : null),
    } as ReturnType<typeof headers> extends Promise<infer T> ? T : never);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockActiveMethods),
        }),
      }),
    } as ReturnType<typeof db.select>);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.methods).toHaveLength(2);
    expect(data.methods[0].name).toBe("Envío estándar");
  });

  it("retorna lista vacía si no hay tenantId en headers", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: () => null,
    } as ReturnType<typeof headers> extends Promise<infer T> ? T : never);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.methods).toHaveLength(0);
  });

  it("filtra métodos inactivos", async () => {
    const { db } = await import("@repo/db");
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => (key === "x-tenant-id" ? "tenant-1" : null),
    } as ReturnType<typeof headers> extends Promise<infer T> ? T : never);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([...mockActiveMethods, mockInactiveMethod]),
        }),
      }),
    } as ReturnType<typeof db.select>);

    const res = await GET();
    const data = await res.json();

    expect(data.methods).toHaveLength(2);
    expect(data.methods.every((m: { isActive: string }) => m.isActive === "true")).toBe(true);
  });

  it("retorna lista vacía si no hay métodos configurados", async () => {
    const { db } = await import("@repo/db");
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => (key === "x-tenant-id" ? "tenant-1" : null),
    } as ReturnType<typeof headers> extends Promise<infer T> ? T : never);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as ReturnType<typeof db.select>);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.methods).toHaveLength(0);
  });
});

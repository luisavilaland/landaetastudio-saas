import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTenantContext } from "@repo/db";
import { makeTxMock } from "@repo/test-utils";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, withTenantContext: vi.fn(), db: { transaction: vi.fn() } };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual, eq: vi.fn(), asc: vi.fn() };
});

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
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(makeTxMock()));
  });

  it("retorna métodos activos cuando hay tenantId en headers", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => (key === "x-tenant-id" ? "tenant-1" : null),
    } as unknown as Awaited<ReturnType<typeof headers>>);

    const tx = makeTxMock({ select: [{ data: mockActiveMethods, terminal: "orderBy" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(tx));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.methods).toHaveLength(2);
    expect(data.methods[0].name).toBe("Envío estándar");
  });

  it("retorna lista vacía si no hay tenantId en headers", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: () => null,
    } as unknown as Awaited<ReturnType<typeof headers>>);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.methods).toHaveLength(0);
  });

  it("filtra métodos inactivos", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => (key === "x-tenant-id" ? "tenant-1" : null),
    } as unknown as Awaited<ReturnType<typeof headers>>);

    const tx = makeTxMock({ select: [{ data: [...mockActiveMethods, mockInactiveMethod], terminal: "orderBy" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(tx));

    const res = await GET();
    const data = await res.json();

    expect(data.methods).toHaveLength(2);
    expect(data.methods.every((m: { isActive: string }) => m.isActive === "true")).toBe(true);
  });

  it("retorna lista vacía si no hay métodos configurados", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => (key === "x-tenant-id" ? "tenant-1" : null),
    } as unknown as Awaited<ReturnType<typeof headers>>);

    const tx = makeTxMock({ select: [{ data: [], terminal: "orderBy" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(tx));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.methods).toHaveLength(0);
  });
});

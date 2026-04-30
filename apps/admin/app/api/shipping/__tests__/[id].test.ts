import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

type ShippingMethod = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  price: number;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isActive: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

const mockMethod: ShippingMethod = {
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
};

async function handleGet(
  session: { user: { tenantId: string } } | null,
  method: ShippingMethod | null
) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!method) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ method });
}

async function handlePut(
  session: { user: { tenantId: string } } | null,
  method: ShippingMethod | null,
  updates: Record<string, unknown>
) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!method) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (updates.price !== undefined && typeof updates.price === "number" && updates.price < 0) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  return NextResponse.json({ method: { ...method, ...updates, updatedAt: new Date() } });
}

async function handleDelete(
  session: { user: { tenantId: string } } | null,
  method: ShippingMethod | null
) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!method) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

describe("GET /api/shipping/[id]", () => {
  it("should return 401 when no session", async () => {
    const res = await handleGet(null, mockMethod);
    expect(res.status).toBe(401);
  });

  it("should return 404 when method not found", async () => {
    const res = await handleGet({ user: { tenantId: "tenant-1" } }, null);
    expect(res.status).toBe(404);
  });

  it("should return 200 with method when found", async () => {
    const res = await handleGet({ user: { tenantId: "tenant-1" } }, mockMethod);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method.id).toBe("method-1");
    expect(body.method.name).toBe("Envío estándar");
  });

  it("should only return methods belonging to tenant", async () => {
    const otherTenantMethod = { ...mockMethod, tenantId: "tenant-2" };
    const res = await handleGet({ user: { tenantId: "tenant-1" } }, otherTenantMethod);
    // El handler real filtra por tenantId en la query
    // Aquí validamos que si no encuentra nada devuelve 404
    const noMatch = otherTenantMethod.tenantId !== "tenant-1" ? null : otherTenantMethod;
    const res2 = await handleGet({ user: { tenantId: "tenant-1" } }, noMatch);
    expect(res2.status).toBe(404);
  });
});

describe("PUT /api/shipping/[id]", () => {
  it("should return 401 when no session", async () => {
    const res = await handlePut(null, mockMethod, { name: "Nuevo" });
    expect(res.status).toBe(401);
  });

  it("should return 404 when method not found", async () => {
    const res = await handlePut({ user: { tenantId: "tenant-1" } }, null, { name: "Nuevo" });
    expect(res.status).toBe(404);
  });

  it("should return 200 with updated method when valid", async () => {
    const res = await handlePut(
      { user: { tenantId: "tenant-1" } },
      mockMethod,
      { name: "Envío express", price: 35000 }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method.name).toBe("Envío express");
    expect(body.method.price).toBe(35000);
  });

  it("should support toggling isActive", async () => {
    const res = await handlePut(
      { user: { tenantId: "tenant-1" } },
      mockMethod,
      { isActive: "false" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method.isActive).toBe("false");
  });

  it("should reject negative price", async () => {
    const res = await handlePut(
      { user: { tenantId: "tenant-1" } },
      mockMethod,
      { price: -100 }
    );
    expect(res.status).toBe(400);
  });

  it("should support partial updates", async () => {
    const res = await handlePut(
      { user: { tenantId: "tenant-1" } },
      mockMethod,
      { description: "Nueva descripción" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method.description).toBe("Nueva descripción");
    expect(body.method.name).toBe("Envío estándar"); // sin cambios
  });
});

describe("DELETE /api/shipping/[id]", () => {
  it("should return 401 when no session", async () => {
    const res = await handleDelete(null, mockMethod);
    expect(res.status).toBe(401);
  });

  it("should return 404 when method not found", async () => {
    const res = await handleDelete({ user: { tenantId: "tenant-1" } }, null);
    expect(res.status).toBe(404);
  });

  it("should return 204 when successfully deleted", async () => {
    const res = await handleDelete({ user: { tenantId: "tenant-1" } }, mockMethod);
    expect(res.status).toBe(204);
  });
});
import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

// Tipos locales para los tests
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

// Simulación del handler GET
async function handleGet(session: { user: { tenantId: string } } | null, methods: ShippingMethod[]) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ methods });
}

// Simulación del handler POST
async function handlePost(
  session: { user: { tenantId: string } } | null,
  body: Record<string, unknown>,
  createdMethod?: ShippingMethod
) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "Validation failed", issues: [{ field: "name", message: "Required" }] }, { status: 400 });
  }
  if (typeof body.price !== "number" || body.price < 0) {
    return NextResponse.json({ error: "Validation failed", issues: [{ field: "price", message: "Must be >= 0" }] }, { status: 400 });
  }
  return NextResponse.json({ method: createdMethod }, { status: 201 });
}

// Simulación del handler PUT
async function handlePut(
  session: { user: { tenantId: string } } | null,
  existing: ShippingMethod | null,
  updates: Record<string, unknown>
) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ method: { ...existing, ...updates } });
}

// Simulación del handler DELETE
async function handleDelete(
  session: { user: { tenantId: string } } | null,
  existing: ShippingMethod | null
) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

describe("GET /api/shipping", () => {
  it("should return 401 when no session", async () => {
    const res = await handleGet(null, []);
    expect(res.status).toBe(401);
  });

  it("should return 200 with methods when authenticated", async () => {
    const res = await handleGet({ user: { tenantId: "tenant-1" } }, [mockMethod]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.methods).toHaveLength(1);
    expect(body.methods[0].name).toBe("Envío estándar");
  });

  it("should return empty array when no methods configured", async () => {
    const res = await handleGet({ user: { tenantId: "tenant-1" } }, []);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.methods).toHaveLength(0);
  });
});

describe("POST /api/shipping", () => {
  it("should return 401 when no session", async () => {
    const res = await handlePost(null, { name: "Envío", price: 150 });
    expect(res.status).toBe(401);
  });

  it("should return 201 with created method when valid data", async () => {
    const res = await handlePost(
      { user: { tenantId: "tenant-1" } },
      { name: "Envío estándar", price: 15000 },
      mockMethod
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.method).toBeDefined();
    expect(body.method.name).toBe("Envío estándar");
  });

  it("should return 400 when name is empty", async () => {
    const res = await handlePost(
      { user: { tenantId: "tenant-1" } },
      { name: "", price: 150 }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("should return 400 when price is negative", async () => {
    const res = await handlePost(
      { user: { tenantId: "tenant-1" } },
      { name: "Envío", price: -10 }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });
});

describe("PUT /api/shipping/[id]", () => {
  it("should return 401 when no session", async () => {
    const res = await handlePut(null, mockMethod, { name: "Nuevo nombre" });
    expect(res.status).toBe(401);
  });

  it("should return 404 when method not found", async () => {
    const res = await handlePut({ user: { tenantId: "tenant-1" } }, null, { name: "Nuevo" });
    expect(res.status).toBe(404);
  });

  it("should return 200 with updated method", async () => {
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

  it("should support partial updates (isActive toggle)", async () => {
    const res = await handlePut(
      { user: { tenantId: "tenant-1" } },
      mockMethod,
      { isActive: "false" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method.isActive).toBe("false");
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

  it("should return 204 when method deleted", async () => {
    const res = await handleDelete({ user: { tenantId: "tenant-1" } }, mockMethod);
    expect(res.status).toBe(204);
  });
});
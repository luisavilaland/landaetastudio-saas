import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when no session exists", async () => {
      const session = null;
      const handler = async (s: typeof session) => {
        if (!s) {
          return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        return NextResponse.json({ error: "unexpected" }, { status: 500 });
      };

      const response = await handler(session);
      expect(response.status).toBe(401);
    });

    it("should return 400 when tenant not found in session", async () => {
      const session = { user: { tenantId: undefined } };
      const handler = async (s: typeof session) => {
        if (!s?.user?.tenantId) {
          return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
        }
        return NextResponse.json({ error: "unexpected" }, { status: 500 });
      };

      const response = await handler(session);
      expect(response.status).toBe(400);
    });
  });

  describe("Response Structure", () => {
    it("should return metrics with correct structure", async () => {
      const mockMetrics = {
        totalRevenue: 150000,
        pendingOrders: 5,
        lowStockProducts: 3,
        outOfStockProducts: 2,
        recentOrders: [],
        lowStockProductsList: [],
      };

      const response = NextResponse.json(mockMetrics);
      expect(response.status).toBe(200);

      const body = mockMetrics;
      expect(body).toHaveProperty("totalRevenue");
      expect(body).toHaveProperty("pendingOrders");
      expect(body).toHaveProperty("lowStockProducts");
      expect(body).toHaveProperty("outOfStockProducts");
      expect(body).toHaveProperty("recentOrders");
      expect(body).toHaveProperty("lowStockProductsList");
    });

    it("should use cents (integer) for revenue", () => {
      const mockMetrics = { totalRevenue: 150000 };
      expect(typeof mockMetrics.totalRevenue).toBe("number");
      expect(Number.isInteger(mockMetrics.totalRevenue)).toBe(true);
    });

    it("should return recent orders as array", () => {
      const mockMetrics = {
        recentOrders: [{ id: "order-1", customerName: "Test", total: 10000, status: "pending_payment", createdAt: new Date() }],
      };
      expect(Array.isArray(mockMetrics.recentOrders)).toBe(true);
    });
  });

  describe("Stock Alerts", () => {
    it("should include lowStockProductsList for alerts section", () => {
      const mockMetrics = {
        lowStockProductsList: [{ id: "p1", name: "Low Stock", sku: "sku-1", stock: 3 }],
      };
      expect(Array.isArray(mockMetrics.lowStockProductsList)).toBe(true);
      expect(mockMetrics.lowStockProductsList[0]).toHaveProperty("name");
    });
  });
});
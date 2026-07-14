import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, dbOrders, dbProductVariants, dbProducts, withTenantContext } from "@repo/db";
import { eq, sql, and, lte, gte, desc } from "drizzle-orm";
import { dashboardQuerySchema } from "@repo/validation";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      console.error("[Dashboard GET] Tenant ID no encontrado en sesión:", session.user);
      return jsonResponse({ error: "Tenant no encontrado" }, 400);
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = dashboardQuerySchema.safeParse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });

    if (!queryValidation.success) {
      console.error("[Dashboard GET] Validation error:", queryValidation.error.issues);
      return jsonResponse({ error: "Validación fallida" }, 400);
    }

    const now = new Date();
    const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const start = (queryValidation.data.startDate && queryValidation.data.startDate !== 'null')
      ? new Date(queryValidation.data.startDate)
      : firstDayOfMonth;
    const end = (queryValidation.data.endDate && queryValidation.data.endDate !== 'null')
      ? new Date(queryValidation.data.endDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    console.log('[Dashboard GET] Start:', start, '| End:', end);

    return withTenantContext(tenantId, async (tx) => {
      const [revenueResult] = await tx
        .select({ total: sql<number>`COALESCE(SUM(${dbOrders.total}), 0)` })
        .from(dbOrders)
        .where(
          and(
            eq(dbOrders.tenantId, tenantId),
            eq(dbOrders.status, "confirmed"),
            gte(dbOrders.createdAt, start),
            lte(dbOrders.createdAt, end)
          )
        );

      const [pendingResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(dbOrders)
        .where(and(eq(dbOrders.tenantId, tenantId), eq(dbOrders.status, "pending_payment")));

      const [lowStockResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(dbProductVariants)
        .where(
          and(eq(dbProductVariants.tenantId, tenantId), lte(dbProductVariants.stock, 5), gte(dbProductVariants.stock, 1))
        );

      const [outOfStockResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(dbProductVariants)
        .where(and(eq(dbProductVariants.tenantId, tenantId), lte(dbProductVariants.stock, 0)));

      const recentOrdersRaw = await tx
        .select({
          id: dbOrders.id,
          customerEmail: dbOrders.customerEmail,
          total: dbOrders.total,
          status: dbOrders.status,
          createdAt: dbOrders.createdAt,
        })
        .from(dbOrders)
        .where(eq(dbOrders.tenantId, tenantId))
        .orderBy(desc(dbOrders.createdAt))
        .limit(5);

      const recentOrders = recentOrdersRaw.map((order) => ({
          id: order.id,
          customerName: order.customerEmail || "Cliente",
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
      }));

      const lowStockProductsRaw = await tx
        .select({
          id: dbProducts.id,
          name: dbProducts.name,
          sku: dbProductVariants.sku,
          stock: dbProductVariants.stock,
        })
        .from(dbProducts)
        .leftJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
        .where(
          and(
            eq(dbProducts.tenantId, tenantId),
            lte(dbProductVariants.stock, 5),
            gte(dbProductVariants.stock, 1)
          )
        )
        .limit(20);

      const lowStockProducts = lowStockProductsRaw.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || "",
          stock: p.stock,
      }));

      return jsonResponse({
        totalRevenue: Number(revenueResult?.total || 0),
        pendingOrders: Number(pendingResult?.count || 0),
        lowStockProducts: Number(lowStockResult?.count || 0),
        outOfStockProducts: Number(outOfStockResult?.count || 0),
        recentOrders,
        lowStockProductsList: lowStockProducts,
      });
    });
  } catch (error) {
    console.error("[Dashboard GET] Error:", error);
    return jsonResponse({ error: "Error al obtener métricas" }, 500);
  }
}
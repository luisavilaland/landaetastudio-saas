import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, dbOrders, dbProductVariants, dbProducts } from "@repo/db";
import { eq, sql, and, lte, gte, desc } from "drizzle-orm";
import { dashboardQuerySchema } from "@repo/validation";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = dashboardQuerySchema.safeParse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: queryValidation.error.issues },
        { status: 400 }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [revenueResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${dbOrders.total}), 0)` })
      .from(dbOrders)
      .where(
        and(
          eq(dbOrders.tenantId, tenantId),
          eq(dbOrders.status, "confirmed"),
          gte(dbOrders.createdAt, startOfMonth),
          lte(dbOrders.createdAt, endOfMonth)
        )
      );

    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dbOrders)
      .where(and(eq(dbOrders.tenantId, tenantId), eq(dbOrders.status, "pending_payment")));

    const [lowStockResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dbProductVariants)
      .where(
        and(eq(dbProductVariants.tenantId, tenantId), lte(dbProductVariants.stock, 5), gte(dbProductVariants.stock, 1))
      );

    const [outOfStockResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dbProductVariants)
      .where(and(eq(dbProductVariants.tenantId, tenantId), lte(dbProductVariants.stock, 0)));

    const recentOrdersRaw = await db
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

    const lowStockProductsRaw = await db
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

    return NextResponse.json({
      totalRevenue: revenueResult?.total || 0,
      pendingOrders: Number(pendingResult?.count || 0),
      lowStockProducts: Number(lowStockResult?.count || 0),
      outOfStockProducts: Number(outOfStockResult?.count || 0),
      recentOrders,
      lowStockProductsList: lowStockProducts,
    });
  } catch (error) {
    console.error("[Dashboard GET] Error:", error);
    return NextResponse.json({ error: "Error al obtener métricas" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, dbOrders, dbCustomers } from "@repo/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
    }

    const orders = await db
      .select({
        id: dbOrders.id,
        customerId: dbOrders.customerId,
        customerEmail: dbOrders.customerEmail,
        total: dbOrders.total,
        status: dbOrders.status,
        createdAt: dbOrders.createdAt,
        updatedAt: dbOrders.updatedAt,
      })
      .from(dbOrders)
      .leftJoin(dbCustomers, eq(dbOrders.customerId, dbCustomers.id))
      .where(eq(dbOrders.tenantId, tenantId))
      .orderBy(dbOrders.createdAt);

    const ordersWithCustomer = orders.map((order) => ({
      id: order.id,
      customerName: order.customerId ? null : null,
      customerEmail: order.customerEmail,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return NextResponse.json(ordersWithCustomer);
  } catch (error) {
    console.error("[Orders GET] Error:", error);
    return NextResponse.json({ error: "Error al obtener órdenes" }, { status: 500 });
  }
}
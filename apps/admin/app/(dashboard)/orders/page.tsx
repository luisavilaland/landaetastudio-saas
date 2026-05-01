import { db, dbOrders } from "@repo/db";
import { OrdersTable } from "./orders-table";

export default async function OrdersPage() {
  const orders = await db
    .select({
      id: dbOrders.id,
      customerEmail: dbOrders.customerEmail,
      total: dbOrders.total,
      status: dbOrders.status,
      createdAt: dbOrders.createdAt,
    })
    .from(dbOrders)
    .orderBy(dbOrders.createdAt);

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
        Órdenes
      </h1>

      {orders.length === 0 ? (
        <p style={{ color: "#666" }}>No hay órdenes aún</p>
      ) : (
        <OrdersTable initialOrders={orders} />
      )}
    </div>
  );
}
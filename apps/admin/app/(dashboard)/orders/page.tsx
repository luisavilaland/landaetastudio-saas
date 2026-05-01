import { db, dbOrders } from "@repo/db";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  refunded: "bg-purple-100 text-purple-800",
  payment_failed: "bg-red-100 text-red-800",
};

function formatStatus(status: string | null): string {
  const labels: Record<string, string> = {
    pending_payment: "Pendiente",
    confirmed: "Confirmado",
    processing: "Procesando",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    payment_failed: "Fallido",
  };
  return (status && labels[status]) || status || "Desconocido";
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
              <th style={{ textAlign: "left", padding: "0.75rem", color: "#666" }}>ID</th>
              <th style={{ textAlign: "left", padding: "0.75rem", color: "#666" }}>Cliente</th>
              <th style={{ textAlign: "left", padding: "0.75rem", color: "#666" }}>Email</th>
              <th style={{ textAlign: "right", padding: "0.75rem", color: "#666" }}>Total</th>
              <th style={{ textAlign: "center", padding: "0.75rem", color: "#666" }}>Status</th>
              <th style={{ textAlign: "right", padding: "0.75rem", color: "#666" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const orderId = order.id || "";
              return (
                <tr
                  key={orderId}
                  style={{ borderBottom: "1px solid #e5e5e5" }}
                >
                  <td style={{ padding: "0.75rem" }}>
                    <Link
                      href={`/orders/${orderId}`}
                      style={{ color: "#2563eb", textDecoration: "underline" }}
                    >
                      {orderId.slice(0, 8)}...
                    </Link>
                  </td>
                  <td style={{ padding: "0.75rem", color: "#666" }}>-</td>
                  <td style={{ padding: "0.75rem" }}>{order.customerEmail || "-"}</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>
                    {formatPrice(order.total || 0)}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <span
                      className={STATUS_COLORS[order.status || ""] || "bg-gray-100 text-gray-800"}
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "#666" }}>
                    {formatDate(order.createdAt || new Date())}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
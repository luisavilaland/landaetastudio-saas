"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ["confirmed", "cancelled", "payment_failed"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  refunded: [],
  payment_failed: ["confirmed"],
};

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

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pendiente",
  confirmed: "Confirmado",
  processing: "Procesando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  payment_failed: "Fallido",
};

function formatStatus(status: string | null): string {
  return (status && STATUS_LABELS[status]) || status || "Desconocido";
}

function formatDate(date: Date | string): string {
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

type Order = {
  id: string;
  customerEmail: string | null;
  total: number;
  status: string | null;
  createdAt: Date | string;
};

export function OrdersTable({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    setMessage(null);

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
        setMessage({ type: "success", text: "Estado actualizado" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Error al actualizar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setUpdatingId(null);
    }
  };

  const allStatuses = Object.keys(STATUS_LABELS);

  return (
    <div>
      {message && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "0.375rem",
            color: "white",
            background: message.type === "success" ? "#16a34a" : "#dc2626",
          }}
        >
          {message.text}
        </div>
      )}

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
            const status = order.status || "";
            const availableTransitions = STATUS_TRANSITIONS[status] || [];
            const isUpdating = updatingId === order.id;

            return (
              <tr
                key={order.id}
                style={{ borderBottom: "1px solid #e5e5e5" }}
              >
                <td style={{ padding: "0.75rem" }}>
                  <Link
                    href={`/orders/${order.id}`}
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                  >
                    {order.id.slice(0, 8)}...
                  </Link>
                </td>
                <td style={{ padding: "0.75rem", color: "#666" }}>-</td>
                <td style={{ padding: "0.75rem" }}>{order.customerEmail || "-"}</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>
                  {formatPrice(order.total || 0)}
                </td>
                <td style={{ padding: "0.75rem", textAlign: "center" }}>
                  <select
                    value={status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    disabled={isUpdating || availableTransitions.length === 0}
                    style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      border: "1px solid #d1d5db",
                      background: STATUS_COLORS[status] || "#f3f4f6",
                      color: "#1f2937",
                      cursor: isUpdating ? "not-allowed" : "pointer",
                      opacity: isUpdating ? 0.7 : 1,
                    }}
                  >
                    {allStatuses.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                        {s === status ? " (actual)" : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "0.75rem", textAlign: "right", color: "#666" }}>
                  {formatDate(order.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

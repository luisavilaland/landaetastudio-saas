"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type OrderDetail = {
  id: string;
  customerId: string | null;
  customerEmail: string | null;
  total: number;
  status: string;
  shippingDetails: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const orderId = params.id as string;

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        }
      } catch (err) {
        setError("Error al cargar orden");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    setError("");

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        router.refresh();
        const res2 = await fetch(`/api/orders/${orderId}`);
        if (res2.ok) {
          setOrder(await res2.json());
        }
      } else {
        const data = await res.json();
        setError(data.error || "Error al actualizar");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Cargando...</div>;
  }

  if (!order) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Orden no encontrada</p>
        <Link href="/orders" style={{ color: "#2563eb" }}>
          Volver a órdenes
        </Link>
      </div>
    );
  }

  const availableTransitions = STATUS_TRANSITIONS[order.status] || [];

  return (
    <div style={{ padding: "2rem", maxWidth: 800 }}>
      <Link
        href="/orders"
        style={{ color: "#2563eb", textDecoration: "underline", marginBottom: "1rem", display: "block" }}
      >
        ← Volver a órdenes
      </Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
        Detalle de Orden
      </h1>

      {error && (
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
      )}

      <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: "semibold", marginBottom: "1rem" }}>Información</h2>
        <p><strong>ID:</strong> {order.id}</p>
        <p><strong>Fecha:</strong> {formatDate(order.createdAt)}</p>
        <p><strong>Total:</strong> {formatPrice(order.total)}</p>
        <p>
          <strong>Status:</strong>{" "}
          <span
            className={STATUS_COLORS[order.status] || "bg-gray-100"}
            style={{
              display: "inline-block",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              fontSize: "0.75rem",
            }}
          >
            {formatStatus(order.status)}
          </span>
        </p>
      </div>

      {order.shippingDetails && (
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "semibold", marginBottom: "1rem" }}>Datos del Cliente</h2>
          <p><strong>Nombre:</strong> {order.shippingDetails.name || "-"}</p>
          <p><strong>Email:</strong> {order.shippingDetails.email || order.customerEmail || "-"}</p>
          <p><strong>Teléfono:</strong> {order.shippingDetails.phone || "-"}</p>
          <p><strong>Dirección:</strong> {order.shippingDetails.address || "-"}</p>
        </div>
      )}

      <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: "semibold", marginBottom: "1rem" }}>Items</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
              <th style={{ textAlign: "left", padding: "0.5rem", color: "#666" }}>Producto</th>
              <th style={{ textAlign: "left", padding: "0.5rem", color: "#666" }}>SKU</th>
              <th style={{ textAlign: "right", padding: "0.5rem", color: "#666" }}>Cantidad</th>
              <th style={{ textAlign: "right", padding: "0.5rem", color: "#666" }}>Precio</th>
              <th style={{ textAlign: "right", padding: "0.5rem", color: "#666" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #e5e5e5" }}>
                <td style={{ padding: "0.5rem" }}>{item.productName}</td>
                <td style={{ padding: "0.5rem", color: "#666" }}>{item.sku}</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{item.quantity}</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{formatPrice(item.unitPrice)}</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{formatPrice(item.unitPrice * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {availableTransitions.length > 0 && (
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "semibold", marginBottom: "1rem" }}>Acciones</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {availableTransitions.map((status) => (
              <button
                key={status}
                onClick={() => updateStatus(status)}
                disabled={updating}
                style={{
                  padding: "0.5rem 1rem",
                  background: status === "cancelled" || status === "payment_failed" ? "#dc2626" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: updating ? "not-allowed" : "pointer",
                  opacity: updating ? 0.7 : 1,
                }}
              >
                {formatStatus(status)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
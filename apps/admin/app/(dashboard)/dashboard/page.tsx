"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardMetrics = {
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  recentOrders: Array<{
    id: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: Date;
  }>;
  lowStockProductsList: Array<{
    id: string;
    name: string;
    sku: string;
    stock: number;
  }>;
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
  });
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMetrics() {
      try {
        console.log("[Dashboard] Fetching metrics from /api/dashboard...");
        const res = await fetch("/api/dashboard");
        console.log("[Dashboard] Response status:", res.status);
        if (res.ok) {
          const data = await res.json();
          console.log("[Dashboard] Response data:", data);
          setMetrics(data);
        } else {
          console.error("[Dashboard] Error response:", res.status);
          setError("Error al cargar métricas");
        }
      } catch (err) {
        console.error("Error de conexión:", err);
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (loading) {
    return <div style={{ padding: "2rem" }}>Cargando métricas...</div>;
  }

  if (error) {
    return <div style={{ padding: "2rem", color: "#dc2626" }}>{error}</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
        Dashboard
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5" }}>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Ventas del mes</p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{formatPrice(metrics?.totalRevenue || 0)}</p>
        </div>

        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5" }}>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Órdenes pendientes</p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{metrics?.pendingOrders || 0}</p>
        </div>

        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5" }}>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Stock bajo</p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: (metrics?.lowStockProducts || 0) > 0 ? "#d97706" : "inherit" }}>
            {metrics?.lowStockProducts || 0}
          </p>
        </div>

        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5" }}>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Agotados</p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: (metrics?.outOfStockProducts || 0) > 0 ? "#dc2626" : "inherit" }}>
            {metrics?.outOfStockProducts || 0}
          </p>
        </div>
      </div>

      <h2 style={{ fontSize: "1.25rem", fontWeight: "semibold", marginBottom: "1rem" }}>
        Últimas órdenes
      </h2>

      {!metrics?.recentOrders || metrics.recentOrders.length === 0 ? (
        <p style={{ color: "#666" }}>No hay actividad reciente</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "0.5rem", overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #e5e5e5" }}>
              <th style={{ textAlign: "left", padding: "0.75rem", color: "#666" }}>ID</th>
              <th style={{ textAlign: "left", padding: "0.75rem", color: "#666" }}>Cliente</th>
              <th style={{ textAlign: "right", padding: "0.75rem", color: "#666" }}>Total</th>
              <th style={{ textAlign: "center", padding: "0.75rem", color: "#666" }}>Status</th>
              <th style={{ textAlign: "right", padding: "0.75rem", color: "#666" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {metrics.recentOrders.map((order) => (
              <tr key={order.id} style={{ borderBottom: "1px solid #e5e5e5" }}>
                <td style={{ padding: "0.75rem" }}>
                  <Link href={`/orders/${order.id}`} style={{ color: "#2563eb", textDecoration: "underline" }}>
                    {order.id.slice(0, 8)}...
                  </Link>
                </td>
                <td style={{ padding: "0.75rem" }}>{order.customerName}</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{formatPrice(order.total)}</td>
                <td style={{ padding: "0.75rem", textAlign: "center" }}>
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
                </td>
                <td style={{ padding: "0.75rem", textAlign: "right", color: "#666" }}>
                  {formatDate(order.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(!metrics?.lowStockProductsList || metrics.lowStockProductsList.length === 0) ? null : (
        <>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "semibold", marginBottom: "1rem", marginTop: "2rem" }}>
            Productos con stock bajo
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "0.5rem", overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #e5e5e5" }}>
                <th style={{ textAlign: "left", padding: "0.75rem", color: "#666" }}>Producto</th>
                <th style={{ textAlign: "left", padding: "0.75rem", color: "#666" }}>SKU</th>
                <th style={{ textAlign: "right", padding: "0.75rem", color: "#666" }}>Stock</th>
                <th style={{ textAlign: "right", padding: "0.75rem", color: "#666" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {metrics.lowStockProductsList.map((product) => (
                <tr key={product.id} style={{ borderBottom: "1px solid #e5e5e5" }}>
                  <td style={{ padding: "0.75rem" }}>{product.name}</td>
                  <td style={{ padding: "0.75rem", color: "#666" }}>{product.sku}</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "#d97706", fontWeight: "bold" }}>
                    {product.stock}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>
                    <Link href={`/products/${product.id}/edit`} style={{ color: "#2563eb", textDecoration: "underline" }}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

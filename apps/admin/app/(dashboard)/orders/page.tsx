import { withTenantContext, dbOrders } from "@repo/db";
import { OrdersTable } from "./orders-table";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

const VALID_STATUSES = [
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

interface OrdersPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await auth();
  if (!session || !session.user.tenantId) {
    return (
      <div style={{ padding: "2rem" }}>
        <p style={{ color: "#666" }}>No autorizado</p>
      </div>
    );
  }
  const tenantId = session.user.tenantId;

  const params = await searchParams;
  const status = params.status && VALID_STATUSES.includes(params.status) ? params.status : undefined;

  const whereConditions = [eq(dbOrders.tenantId, tenantId)];
  if (status) {
    whereConditions.push(eq(dbOrders.status, status));
  }

  const orders = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({
        id: dbOrders.id,
        customerEmail: dbOrders.customerEmail,
        total: dbOrders.total,
        status: dbOrders.status,
        createdAt: dbOrders.createdAt,
      })
      .from(dbOrders)
      .where(and(...whereConditions))
      .orderBy(dbOrders.createdAt)
  );

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
        Órdenes
      </h1>

      <OrdersTable initialOrders={orders} currentStatus={status} />

      {orders.length === 0 && (
        <p style={{ color: "#666", marginTop: "1rem" }}>No hay órdenes aún</p>
      )}
    </div>
  );
}
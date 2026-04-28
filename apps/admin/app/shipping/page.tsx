import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, dbShippingMethods } from "@repo/db";
import { eq, asc } from "drizzle-orm";
import { ShippingMethodsTable } from "./shipping-table";

export const dynamic = "force-dynamic";

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default async function ShippingPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const tenantId = session.user?.tenantId as string;

  const methods = await db
    .select()
    .from(dbShippingMethods)
    .where(eq(dbShippingMethods.tenantId, tenantId))
    .orderBy(asc(dbShippingMethods.sortOrder));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Métodos de Envío</h1>
        <a
          href="/shipping/new"
          className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-800"
        >
          Nuevo método
        </a>
      </div>

      <ShippingMethodsTable initialMethods={methods} />
    </div>
  );
}
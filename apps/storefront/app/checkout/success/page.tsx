import { Suspense } from "react";
import { headers } from "next/headers";
import { db, dbOrders } from "@repo/db";
import { eq } from "drizzle-orm";

type Props = {
  searchParams: { order_id?: string };
};

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const orderId = searchParams.order_id;

  let order = null;
  if (orderId) {
    const [o] = await db
      .select()
      .from(dbOrders)
      .where(eq(dbOrders.id, orderId))
      .limit(1);
    order = o;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          ¡Gracias por tu compra!
        </h1>
        {order && (
          <p className="text-gray-600 mb-2">
            Orden: {order.id}
          </p>
        )}
        <p className="text-gray-600">
          Recibirás un email de confirmación en {order?.customerEmail}
        </p>
        <a
          href="/"
          className="inline-block mt-6 text-blue-600 hover:underline"
        >
          Volver a la tienda
        </a>
      </div>
    </div>
  );
}
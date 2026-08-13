import { Suspense } from 'react'
import { headers } from 'next/headers'
import { withTenantContext, dbOrders } from '@repo/db'
import { eq } from 'drizzle-orm'
import { getTenantId } from '@/lib/tenant'

type Props = {
  searchParams: { order_id?: string }
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const orderId = searchParams.order_id

  let order = null
  if (orderId) {
    const tenantId = await getTenantId()
    if (tenantId) {
      const [o] = await withTenantContext(tenantId, async (tx) =>
        tx.select().from(dbOrders).where(eq(dbOrders.id, orderId)).limit(1),
      )
      order = o
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-green-600">
          ¡Gracias por tu compra!
        </h1>
        {order && <p className="mb-2 text-gray-600">Orden: {order.id}</p>}
        <p className="text-gray-600">
          Recibirás un email de confirmación en {order?.customerEmail}
        </p>
        <a href="/" className="mt-6 inline-block text-blue-600 hover:underline">
          Volver a la tienda
        </a>
      </div>
    </div>
  )
}

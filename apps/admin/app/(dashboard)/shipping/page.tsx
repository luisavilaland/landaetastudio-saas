import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { withTenantContext, dbShippingMethods } from '@repo/db'
import { eq, asc } from 'drizzle-orm'
import { ShippingMethodsTable } from './shipping-table'

export const dynamic = 'force-dynamic'

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default async function ShippingPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const tenantId = session.user?.tenantId as string

  const methods = await withTenantContext(tenantId, async (tx) =>
    tx
      .select()
      .from(dbShippingMethods)
      .where(eq(dbShippingMethods.tenantId, tenantId))
      .orderBy(asc(dbShippingMethods.sortOrder)),
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Métodos de Envío</h1>
        <a
          href="/shipping/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          Nuevo método
        </a>
      </div>

      <ShippingMethodsTable initialMethods={methods} />
    </div>
  )
}

import { db, dbCustomers, dbTenants, withTenantContext } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export interface CustomerSessionUser {
  id: string
  email: string
  tenantId: string
  name?: string
}

/**
 * Resuelve el tenantId de la petición: primero el header que inyecta el proxy
 * (`x-tenant-id`) y, si no existe, resolviendo por host contra `dbTenants`
 * (tabla sin RLS). Sin tenant no hay contexto sobre el que autenticar.
 */
export async function resolveTenantId(
  request?: Request | null,
): Promise<string | null> {
  const headerId = request?.headers.get('x-tenant-id')
  if (headerId) return headerId

  const host = request?.headers.get('host')?.replace(/:\d+$/, '')
  if (!host || !host.includes('.') || host.startsWith('localhost')) return null

  const byDomain = await db
    .select({ id: dbTenants.id })
    .from(dbTenants)
    .where(eq(dbTenants.customDomain, host))
    .limit(1)
  if (byDomain.length > 0) return byDomain[0].id

  const sub = host.split('.')[0]
  const bySlug = await db
    .select({ id: dbTenants.id })
    .from(dbTenants)
    .where(eq(dbTenants.slug, sub))
    .limit(1)
  return bySlug.length > 0 ? bySlug[0].id : null
}

/**
 * Autentica un customer dentro del contexto RLS del tenant. `dbCustomers` tiene
 * RLS activo: sin `withTenantContext` el query contra el rol `app_user` no ve
 * filas y el login siempre falla. El lookup es tenant-scoped (un cliente solo
 * inicia sesión en su propia tienda).
 */
export async function authorizeCustomer(
  email: string,
  password: string,
  tenantId: string,
): Promise<CustomerSessionUser | null> {
  if (!email || !password || !tenantId) return null

  return await withTenantContext(tenantId, async (tx) => {
    const [customer] = await tx
      .select({
        id: dbCustomers.id,
        tenantId: dbCustomers.tenantId,
        email: dbCustomers.email,
        password: dbCustomers.password,
        name: dbCustomers.name,
      })
      .from(dbCustomers)
      .where(
        and(eq(dbCustomers.email, email), eq(dbCustomers.tenantId, tenantId)),
      )
      .limit(1)

    if (!customer || !customer.password) return null

    const isValid = await bcrypt.compare(password, customer.password)
    if (!isValid) return null

    return {
      id: customer.id,
      email: customer.email,
      tenantId: customer.tenantId,
      name: customer.name || undefined,
    }
  })
}

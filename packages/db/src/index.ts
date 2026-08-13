import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema'

const appUrl = process.env.DATABASE_APP_URL
if (!appUrl) {
  throw new Error(
    'DATABASE_APP_URL no configurada. Usa un rol sin BYPASSRLS (ej: app_user).',
  )
}
const client = postgres(appUrl)
export const db = drizzle(client, { schema })

type DbLike = Omit<typeof db, '$client'>

export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: DbLike) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_tenant_id(${tenantId}::uuid)`)
    return await callback(tx)
  })
}

export { schema }
export * from './schema'

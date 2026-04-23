import { db, dbTenants } from "@repo/db";
import { TenantsTable } from "./tenants-table";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await db.select().from(dbTenants);

  return <TenantsTable initialTenants={tenants} />;
}
import { db, dbTenants } from "@repo/db";
import { TenantForm } from "@/components/tenant-form";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditTenantPage({ params }: Props) {
  const { id } = await params;

  const tenant = await db
    .select()
    .from(dbTenants)
    .where(eq(dbTenants.id, id))
    .limit(1);

  if (tenant.length === 0) {
    notFound();
  }

  return <TenantForm tenant={tenant[0]} isEdit />;
}
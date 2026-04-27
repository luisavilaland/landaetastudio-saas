import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, dbCategories } from "@repo/db";
import { eq, desc } from "drizzle-orm";
import { CategoriesTable } from "./categories-table";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const tenantId = session.user?.tenantId as string;

  const categories = await db
    .select()
    .from(dbCategories)
    .where(eq(dbCategories.tenantId, tenantId))
    .orderBy(desc(dbCategories.createdAt));

  return <CategoriesTable initialCategories={categories} />;
}
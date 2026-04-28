import { db, dbCategories } from "@repo/db";
import { eq } from "drizzle-orm";

export type CategoryData = {
  id: string;
  name: string;
  slug: string;
};

export async function getCategoriesForTenant(tenantId: string): Promise<CategoryData[]> {
  try {
    const categories = await db
      .select({
        id: dbCategories.id,
        name: dbCategories.name,
        slug: dbCategories.slug,
      })
      .from(dbCategories)
      .where(eq(dbCategories.tenantId, tenantId))
      .orderBy(dbCategories.name);

    return categories;
  } catch {
    return [];
  }
}

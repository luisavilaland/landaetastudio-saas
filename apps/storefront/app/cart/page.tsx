import { headers } from "next/headers";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { getCart } from "@/lib/cart";
import { CartList } from "@/components/cart-list";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const headersList = await headers();
  const sessionId = headersList.get("x-cart-session-id");
  const tenantSlug = headersList.get("x-tenant-slug") || "default";

  let tenantId: string | null = null;
  try {
    const tenant = await db
      .select({ id: dbTenants.id })
      .from(dbTenants)
      .where(eq(dbTenants.slug, tenantSlug))
      .limit(1);
    if (tenant.length > 0) {
      tenantId = tenant[0].id;
    }
  } catch {
    // fallthrough — cart vacío
  }

  const items = sessionId && tenantId ? await getCart(sessionId, tenantId) : [];

  return <CartList initialItems={items} />;
}
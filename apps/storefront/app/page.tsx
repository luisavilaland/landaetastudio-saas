import { headers } from "next/headers";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const headersList = await headers();
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
    // ignore
  }

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Tienda no encontrada
          </h1>
          <p className="mt-2 text-zinc-500">
            El subdomain &quot;{tenantSlug}&quot; no existe.
          </p>
        </div>
      </div>
    );
  }

  const products = await getProducts(tenantId, 12);

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Esta tienda aún no tiene productos
          </h1>
          <p className="mt-2 text-zinc-500">
            Pronto habrá novedades.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-6">Productos</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
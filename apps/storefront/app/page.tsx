import { headers } from "next/headers";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import { getTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";
  const { category: categorySlug } = await searchParams;

  const resolvedTenantSlug = await getTenantId();

  if (!resolvedTenantSlug) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Tienda no encontrada
          </h1>
          <p className="mt-2 text-zinc-500">
            El subdominio "{tenantSlug}" no existe.
          </p>
        </div>
      </div>
    );
  }

  const products = await getProducts(resolvedTenantSlug, 12, categorySlug);

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

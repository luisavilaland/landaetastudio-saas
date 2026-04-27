import { db, dbProducts, dbProductVariants, dbProductImages, dbTenants } from "@repo/db";
import { getTenantId } from "@/lib/tenant";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";

const LIMIT = 12;

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

export async function SearchResults({
  query,
  offset,
}: {
  query: string;
  offset: number;
}) {
  if (!query.trim()) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>Ingresa un término de búsqueda</p>
      </div>
    );
  }

  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "default";
  const tenantId = await getTenantId(tenantSlug);

  if (!tenantId) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>Tenant no encontrado</p>
      </div>
    );
  }

  const searchPattern = `%${query}%`;
  const limit = LIMIT;
  const currentOffset = offset || 0;

  const whereConditions = and(
    eq(dbProducts.tenantId, tenantId),
    eq(dbProducts.status, "active"),
    or(
      ilike(dbProducts.name, searchPattern),
      ilike(dbProducts.description, searchPattern),
      ilike(dbProductVariants.sku, searchPattern)
    )
  );

  const productsQuery = db
    .select({
      id: dbProducts.id,
      name: dbProducts.name,
      slug: dbProducts.slug,
      description: dbProducts.description,
      imageUrl: dbProducts.imageUrl,
      status: dbProducts.status,
      createdAt: dbProducts.createdAt,
    })
    .from(dbProducts)
    .leftJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(whereConditions)
    .groupBy(dbProducts.id)
    .orderBy(desc(dbProducts.createdAt))
    .limit(limit)
    .offset(currentOffset);

  const countQuery = db
    .select({ count: sql<number>`count(distinct ${dbProducts.id})` })
    .from(dbProducts)
    .leftJoin(dbProductVariants, eq(dbProducts.id, dbProductVariants.productId))
    .where(whereConditions);

  const [products, countResult] = await Promise.all([
    productsQuery,
    countQuery,
  ]);

  const total = countResult[0]?.count || 0;
  const productIds = products.map((p) => p.id);

  const variants = await db
    .select({
      id: dbProductVariants.id,
      productId: dbProductVariants.productId,
      price: dbProductVariants.price,
      stock: dbProductVariants.stock,
      sku: dbProductVariants.sku,
    })
    .from(dbProductVariants)
    .where(
      and(
        eq(dbProductVariants.tenantId, tenantId),
        sql`${dbProductVariants.productId} in ${productIds}`
      )
    );

  const images = await db
    .select({
      id: dbProductImages.id,
      productId: dbProductImages.productId,
      url: dbProductImages.url,
      alt: dbProductImages.alt,
      position: dbProductImages.position,
    })
    .from(dbProductImages)
    .where(
      and(
        eq(dbProductImages.tenantId, tenantId),
        sql`${dbProductImages.productId} in ${productIds}`
      )
    )
    .orderBy(dbProductImages.position);

  const variantsByProduct = variants.reduce((acc, v) => {
    if (!acc[v.productId]) acc[v.productId] = [];
    acc[v.productId].push(v);
    return acc;
  }, {} as Record<string, typeof variants>);

  const imagesByProduct = images.reduce((acc, img) => {
    if (!acc[img.productId]) acc[img.productId] = [];
    acc[img.productId].push(img);
    return acc;
  }, {} as Record<string, typeof images>);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(currentOffset / limit) + 1;

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>No se encontraron productos para &quot;{query}&quot;</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-zinc-500 mb-4">
        {total} resultado{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => {
          const productVariants = variantsByProduct[product.id] || [];
          const productImages = imagesByProduct[product.id] || [];
          const prices = productVariants.map((v) => v.price);
          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
          const firstImage = productImages.length > 0 ? productImages[0] : null;
          const stock = productVariants.reduce(
            (sum, v) => sum + (v.stock || 0),
            0
          );

          return (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group block bg-white border border-zinc-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-zinc-100 relative">
                {firstImage ? (
                  <Image
                    src={firstImage.url}
                    alt={firstImage.alt || product.name}
                    fill
                    unoptimized={true}
                    className="object-cover"
                  />
                ) : product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    unoptimized={true}
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
                    Sin imagen
                  </div>
                )}
                {stock <= 0 && (
                  <span className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    Agotado
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-zinc-900 group-hover:text-zinc-600 line-clamp-2">
                  {product.name}
                </h3>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {minPrice === maxPrice
                    ? formatPrice(minPrice)
                    : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
                </p>
                {product.description && (
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                    {product.description}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/buscar?q=${encodeURIComponent(query)}&offset=${(currentPage - 2) * limit}`}
              className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
            >
              Anterior
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-zinc-600">
            Página {currentPage} de {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/buscar?q=${encodeURIComponent(query)}&offset=${currentPage * limit}`}
              className="px-4 py-2 text-sm border border-zinc-300 rounded-md hover:bg-zinc-50"
            >
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

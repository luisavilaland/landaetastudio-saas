import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { getProductBySlug } from "@/lib/products";
import { AddToCartButton } from "@/components/add-to-cart-button";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
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
    return { title: "Producto no encontrado" };
  }

  if (!tenantId) {
    return { title: "Tienda no encontrada" };
  }

  const product = await getProductBySlug(tenantId, slug);

  if (!product) {
    return { title: "Producto no encontrado" };
  }

  return {
    title: product.name,
    description: product.description || product.name,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
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
    return notFound();
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

  const product = await getProductBySlug(tenantId, slug);

  if (!product) {
    return notFound();
  }

  const price = product.variant?.price ?? 0;
  const stock = product.variant?.stock ?? 0;
  const inStock = stock > 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-700 mb-6 inline-block"
      >
        &larr; Volver al catálogo
      </Link>

      <div className="grid md:grid-cols-2 gap-8 mt-4">
        <div className="bg-zinc-100 rounded-lg overflow-hidden aspect-square relative">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              unoptimized={true}
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-3xl font-semibold text-zinc-900">
            {product.name}
          </h1>

          <p className="mt-4 text-3xl font-bold text-zinc-900">
            {formatPrice(price)}
          </p>

          <div className="mt-4">
            {inStock ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                En stock ({stock} disponibles)
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                Agotado
              </span>
            )}
          </div>

          {product.description && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-zinc-700 mb-2">Descripción</h2>
              <p className="text-zinc-600 whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          <div className="mt-auto pt-6">
            <AddToCartButton
              variantId={product.variant?.id ?? ""}
              inStock={inStock}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
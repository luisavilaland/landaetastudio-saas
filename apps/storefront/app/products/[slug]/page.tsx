import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { getProductBySlug } from "@/lib/products";
import { ImageGallery } from "@/components/image-gallery";
import { VariantSelector } from "@/components/variant-selector";

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
    return { title: "Producto no encontrado" };
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

function getAttributesFromVariants(variants: { options: Record<string, string> }[]) {
  const attrMap = new Map<string, Set<string>>();

  variants.forEach(v => {
    Object.entries(v.options || {}).forEach(([key, value]) => {
      if (!attrMap.has(key)) {
        attrMap.set(key, new Set());
      }
      attrMap.get(key)!.add(value);
    });
  });

  return Array.from(attrMap.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
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

  const attributes = getAttributesFromVariants(product.variants);
  const firstVariant = product.variants[0];
  const defaultSelected = firstVariant
    ? Object.fromEntries(Object.entries(firstVariant.options || {}))
    : {};

  const allImages = product.images && product.images.length > 0
    ? product.images.map(img => ({ ...img, position: img.position ?? 0 }))
    : product.imageUrl
    ? [{ id: 'default', url: product.imageUrl, alt: product.name, position: 0 }]
    : [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-700 mb-6 inline-block"
      >
        &larr; Volver al catálogo
      </Link>

      <div className="grid md:grid-cols-2 gap-8 mt-4">
        <div>
          <ImageGallery images={allImages} productName={product.name} />
        </div>

        <div className="flex flex-col">
          <h1 className="text-3xl font-semibold text-zinc-900">
            {product.name}
          </h1>

          <VariantSelector
            product={product}
            attributes={attributes}
            defaultSelected={defaultSelected}
          />
        </div>
      </div>
    </div>
  );
}

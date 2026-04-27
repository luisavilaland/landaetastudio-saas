import Link from "next/link";
import Image from "next/image";
import type { ProductWithVariants } from "@/lib/products";

type ProductCardProps = {
  product: ProductWithVariants;
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

function getFirstAvailableVariant(product: ProductWithVariants) {
  return product.variants.find(v => (v.stock ?? 0) > 0) || product.variants[0];
}

export function ProductCard({ product }: ProductCardProps) {
  const displayVariant = getFirstAvailableVariant(product);
  const price = displayVariant?.price ?? 0;
  const stock = displayVariant?.stock ?? 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block bg-white border border-zinc-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square bg-zinc-100 relative">
        {product.imageUrl ? (
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
        <h3 className="font-medium text-zinc-900 group-hover:text-zinc-600">
          {product.name}
        </h3>
        <p className="mt-1 text-lg font-semibold text-zinc-900">
          {formatPrice(price)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {stock <= 0 ? "Agotado" : `${stock} disponibles`}
        </p>
      </div>
    </Link>
  );
}
import Link from "next/link";
import Image from "next/image";
import type { ProductWithVariant } from "@/lib/products";

type ProductCardProps = {
  product: ProductWithVariant;
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

export function ProductCard({ product }: ProductCardProps) {
  const price = product.variant?.price ?? 0;
  const stock = product.variant?.stock ?? 0;

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
      </div>
      <div className="p-4">
        <h3 className="font-medium text-zinc-900 group-hover:text-zinc-600">
          {product.name}
        </h3>
        <p className="mt-1 text-lg font-semibold text-zinc-900">
          {formatPrice(price)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {stock > 0 ? `${stock} disponibles` : "Sin stock"}
        </p>
      </div>
    </Link>
  );
}
"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProductWithVariants } from "@/lib/products";
import { AddToCartButton } from "@/components/add-to-cart-button";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

function findVariantByOptions(
  variants: ProductWithVariants["variants"],
  selected: Record<string, string>
) {
  return variants.find(v => {
    return Object.entries(selected).every(([key, value]) => v.options[key] === value);
  });
}

export function VariantSelector({
  product,
  attributes,
  defaultSelected,
}: {
  product: ProductWithVariants;
  attributes: { name: string; values: string[] }[];
  defaultSelected: Record<string, string>;
}) {
  const [selected, setSelected] = useState<Record<string, string>>(defaultSelected);

  const selectedVariant = findVariantByOptions(product.variants, selected);

  const price = selectedVariant?.price ?? 0;
  const stock = selectedVariant?.stock ?? 0;
  const inStock = stock > 0;

  const handleSelect = (attrName: string, value: string) => {
    setSelected(prev => ({ ...prev, [attrName]: value }));
  };

  return (
    <div className="flex flex-col">
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

      {attributes.length > 0 && (
        <div className="mt-6 space-y-4">
          {attributes.map(attr => (
            <div key={attr.name}>
              <h3 className="text-sm font-medium text-zinc-700 mb-2">{attr.name}</h3>
              <div className="flex flex-wrap gap-2">
                {attr.values.map(value => {
                  const isSelected = selected[attr.name] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSelect(attr.name, value)}
                      className={`px-3 py-1 text-sm rounded-md border ${
                        isSelected
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

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
          variantId={selectedVariant?.id ?? ""}
          inStock={inStock}
        />
      </div>
    </div>
  );
}

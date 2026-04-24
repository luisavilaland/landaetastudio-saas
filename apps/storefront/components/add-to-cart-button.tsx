"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  variantId: string;
  inStock: boolean;
};

export function AddToCartButton({ variantId, inStock }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAddToCart = async () => {
    if (!inStock) return;

    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: 1 }),
      });

      if (res.ok) {
        setAdded(true);
        setTimeout(() => {
          router.refresh();
        }, 1500);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
    } finally {
      setLoading(false);
    }
  };

  if (added) {
    return (
      <Link
        href="/cart"
        className="w-full block text-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
      >
        ✓ Agregado al carrito
      </Link>
    );
  }

  return (
    <button
      onClick={handleAddToCart}
      disabled={!inStock || loading}
      className={`w-full block text-center px-6 py-3 font-medium rounded-lg ${
        inStock
          ? "bg-zinc-900 text-white hover:bg-zinc-800"
          : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
      }`}
    >
      {loading ? "Agregando..." : inStock ? "Agregar al carrito" : "Agotado"}
    </button>
  );
}
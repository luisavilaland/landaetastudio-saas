"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type CartItem = {
  variantId: string;
  quantity: number;
  addedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    price: number;
    stock: number | null;
  } | null;
  variant?: {
    sku: string;
    options: Record<string, string>;
  };
};

type Props = {
  initialItems: CartItem[];
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(cents / 100);
}

export function CartList({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>(initialItems || []);
  const [loading, setLoading] = useState(false);

  const fetchCartItems = async () => {
    try {
      const res = await fetch("/api/cart", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  };

  const updateQuantity = async (variantId: string, quantity: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity }),
      });

      if (res.ok) {
        await fetchCartItems();
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (variantId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId }),
      });

      if (res.ok) {
        await fetchCartItems();
      }
    } catch (error) {
      console.error("Error removing item:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    if (!confirm("¿Vaciar el carrito?")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });

      if (res.ok) {
        setItems([]);
      }
    } catch (error) {
      console.error("Error clearing cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const safeItems = Array.isArray(items) ? items : [];

  if (!Array.isArray(items)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-zinc-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (safeItems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <svg
              className="w-16 h-16 mx-auto text-zinc-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Tu carrito está vacío
          </h1>
          <p className="mt-2 text-zinc-500">
            Aún no has agregado productos. Explora nuestro catálogo y añade lo
            que te guste.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800"
          >
            Seguir comprando
          </Link>
        </div>
      </div>
    );
  }

  const total = safeItems.reduce((sum, item) => {
    const price = item.product?.price ?? 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Carrito</h1>
        <button
          onClick={clearCart}
          disabled={loading}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Vaciar carrito
        </button>
      </div>

      <div className="space-y-4">
        {safeItems.map((item) => {
          const price = item.product?.price ?? 0;
          const subtotal = price * item.quantity;

          return (
            <div
              key={item.variantId}
              className="flex items-center gap-4 bg-white border border-zinc-200 rounded-lg p-4"
            >
              <div className="w-20 h-20 bg-zinc-100 rounded-md overflow-hidden relative flex-shrink-0">
                {item.product?.imageUrl ? (
                  <Image
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs">
                    Sin img
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.product?.slug}`}
                  className="text-lg font-medium text-zinc-900 hover:text-zinc-700"
                >
                  {item.product?.name}
                </Link>
                {item.variant?.options && Object.keys(item.variant.options).length > 0 && (
                  <p className="text-sm text-zinc-500">
                    {Object.entries(item.variant.options)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(", ")}
                  </p>
                )}
                <p className="text-sm text-zinc-500">
                  {formatPrice(price)} c/u
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateQuantity(item.variantId, item.quantity - 1)
                  }
                  disabled={loading || item.quantity <= 1}
                  className="w-8 h-8 flex items-center justify-center border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50"
                >
                  -
                </button>
                <span className="w-12 text-center">{item.quantity}</span>
                <button
                  onClick={() =>
                    updateQuantity(item.variantId, item.quantity + 1)
                  }
                  disabled={loading}
                  className="w-8 h-8 flex items-center justify-center border border-zinc-300 rounded hover:bg-zinc-100 disabled:opacity-50"
                >
                  +
                </button>
              </div>

              <div className="w-24 text-right font-medium">
                {formatPrice(subtotal)}
              </div>

              <button
                onClick={() => removeItem(item.variantId)}
                disabled={loading}
                className="text-red-600 hover:text-red-800 p-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-6">
        <div className="flex justify-between items-center text-xl font-semibold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>

        <div className="mt-6 flex gap-4">
          <Link
            href="/checkout"
            className="flex-1 text-center px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800"
          >
            Continuar compra
          </Link>
          <Link
            href="/"
            className="flex-1 text-center px-6 py-3 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50"
          >
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
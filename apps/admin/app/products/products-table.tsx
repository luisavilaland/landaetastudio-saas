"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

type ProductVariant = {
  id: string;
  sku: string;
  price: number;
  stock: number;
  options: Record<string, unknown>;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  description: string | null;
  status: string;
  createdAt: Date;
  categoryName: string | null;
  variant?: ProductVariant;
};

function StockCell({
  productId,
  variantId,
  initialStock,
}: {
  productId: string;
  variantId?: string;
  initialStock: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initialStock ?? ""));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stock = initialStock ?? 0;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    if (!variantId) return;
    const newStock = parseInt(value, 10);
    if (isNaN(newStock) || newStock < 0) {
      setError(true);
      setTimeout(() => setError(false), 1500);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setEditing(false);
        }, 1000);
      } else {
        setError(true);
        setTimeout(() => setError(false), 1500);
      }
    } catch {
      setError(true);
      setTimeout(() => setError(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setValue(String(initialStock ?? ""));
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-20 px-2 py-1 border rounded text-sm"
          disabled={saving}
        />
        {saving && <span className="text-xs text-zinc-500">Guardando...</span>}
        {success && <span className="text-xs text-green-600">✓</span>}
        {error && <span className="text-xs text-red-600">Error</span>}
      </div>
    );
  }

  if (isOutOfStock) {
    return (
      <span
        onClick={() => variantId && setEditing(true)}
        className={variantId ? "cursor-pointer text-red-600 font-medium" : "text-red-600 font-medium"}
      >
        Agotado
      </span>
    );
  }

  if (isLowStock) {
    return (
      <span
        onClick={() => variantId && setEditing(true)}
        className={variantId ? "cursor-pointer text-amber-600 font-medium" : "text-amber-600 font-medium"}
      >
        {stock}
      </span>
    );
  }

  return (
    <span
      onClick={() => variantId && setEditing(true)}
      className={variantId ? "cursor-pointer" : ""}
    >
      {stock}
    </span>
  );
}

export function ProductsTable({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-UY");
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "UYU",
    }).format(cents / 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <button
          onClick={() => router.push("/products/new")}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
        >
          Nuevo Producto
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Imagen</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Categoría</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Precio</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Stock</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Creado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No hay productos. Crea el primero.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-sm">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-zinc-100 rounded-md flex items-center justify-center text-zinc-400 text-xs">
                        Sin img
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{product.name}</td>
                  <td className="px-4 py-3 text-sm">{product.categoryName || "-"}</td>
                  <td className="px-4 py-3 text-sm">{product.slug}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        product.status === "active"
                          ? "bg-green-100 text-green-700"
                          : product.status === "draft"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {product.variant ? formatPrice(product.variant.price) : "-"}
                  </td>
<td className="px-4 py-3 text-sm">
                      <StockCell
                        productId={product.id}
                        variantId={product.variant?.id}
                        initialStock={product.variant?.stock ?? null}
                      />
                    </td>
                  <td className="px-4 py-3 text-sm">{formatDate(product.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => router.push(`/products/${product.id}/edit`)}
                      className="px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900 mr-2"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
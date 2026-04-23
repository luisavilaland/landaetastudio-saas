"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  variant?: ProductVariant;
};

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
                    {product.variant?.stock ?? "-"}
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
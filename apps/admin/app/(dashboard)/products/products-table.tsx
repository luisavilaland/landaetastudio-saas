"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CSVImport } from "./csv-import";
import { captureException } from "@sentry/nextjs";

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
  variants: ProductVariant[];
  images?: { url: string }[];
};

export function ProductsTable({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
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
      captureException(error);
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
        <div className="flex gap-3">
          <CSVImport onImportComplete={() => router.refresh()} />
          <button
            onClick={() => router.push("/products/new")}
            className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
          >
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Imagen
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Categoría
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Variantes
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Precio
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Stock total
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Creado
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-600">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No hay productos. Crea el primero.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const variantCount = product.variants.length;
                const totalStock = product.variants.reduce(
                  (sum, v) => sum + v.stock,
                  0,
                );
                const firstVariant = product.variants[0];

                return (
                  <tr key={product.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-md"
                        />
                      ) : product.imageUrl ? (
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
                    <td className="px-4 py-3 text-sm">
                      {product.categoryName || "-"}
                    </td>
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
                      {variantCount > 0 ? (
                        <span className="text-sm">
                          {variantCount} variante{variantCount !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-sm text-zinc-400">
                          Sin variantes
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {firstVariant ? formatPrice(firstVariant.price) : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        title="Stock combinado de variantes"
                        className="cursor-help"
                      >
                        {totalStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatDate(product.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          router.push(`/products/${product.id}/edit`)
                        }
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

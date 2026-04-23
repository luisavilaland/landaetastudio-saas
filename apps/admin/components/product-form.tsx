"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Product = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  status?: string;
  variant?: {
    price: number;
    stock: number;
  } | null;
};

type Props = {
  initialProduct?: Product;
  mode?: "create" | "edit";
};

export function ProductForm({ initialProduct, mode = "create" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: initialProduct?.name || "",
    slug: initialProduct?.slug || "",
    description: initialProduct?.description || "",
    status: initialProduct?.status || "draft",
    price: initialProduct?.variant ? initialProduct.variant.price / 100 : "",
    stock: initialProduct?.variant ? initialProduct.variant.stock : "",
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const priceInCents = Math.round(Number(form.price) * 100);

    try {
      const url =
        mode === "edit" && initialProduct?.id
          ? `/api/products/${initialProduct.id}`
          : "/api/products";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          status: form.status,
          price: priceInCents,
          stock: Number(form.stock),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error saving product");
      }

      router.push("/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6">
        {mode === "edit" ? "Editar Producto" : "Nuevo Producto"}
      </h1>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
            Nombre
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={handleNameChange}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="Mi Producto"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-zinc-700">
            Slug
          </label>
          <input
            id="slug"
            type="text"
            required
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="mi-producto"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-zinc-700"
          >
            Descripción
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            rows={3}
            placeholder="Descripción del producto..."
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-zinc-700">
            Estado
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-zinc-700">
            Precio (UYU)
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="199.00"
          />
        </div>

        <div>
          <label htmlFor="stock" className="block text-sm font-medium text-zinc-700">
            Stock
          </label>
          <input
            id="stock"
            type="number"
            min="0"
            required
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            placeholder="100"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="px-4 py-2 border border-zinc-300 rounded-md hover:bg-zinc-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
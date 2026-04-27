"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export function CategoriesTable({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", slug: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, slug: category.slug });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", slug: "" });
    }
    setError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", slug: "" });
    setError("");
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      name,
      slug: editingCategory ? prev.slug : generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : "/api/categories";

      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al guardar");
        setSaving(false);
        return;
      }

      if (editingCategory) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory.id
              ? { ...c, ...formData }
              : c
          )
        );
      } else {
        setCategories((prev) => [data.category, ...prev]);
      }

      handleCloseModal();
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al eliminar");
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-UY");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
        >
          Nueva Categoría
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Creado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No hay categorías. Crea la primera.
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-sm">{category.name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{category.slug}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(category.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenModal(category)}
                      className="px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900 mr-2"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-zinc-600 hover:text-zinc-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
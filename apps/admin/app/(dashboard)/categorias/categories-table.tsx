'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { captureException } from '@sentry/nextjs'

type Category = {
  id: string
  name: string
  slug: string
  createdAt: Date
  updatedAt: Date
}

export function CategoriesTable({
  initialCategories,
}: {
  initialCategories: Category[]
}) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({ name: category.name, slug: category.slug })
    } else {
      setEditingCategory(null)
      setFormData({ name: '', slug: '' })
    }
    setError('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setFormData({ name: '', slug: '' })
    setError('')
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      name,
      slug: generateSlug(name),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories'

      const method = editingCategory ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409 && data.field) {
          setFieldErrors({ [data.field]: data.error })
        } else {
          setError(data.error || 'Error al guardar')
        }
        setSaving(false)
        return
      }

      if (editingCategory) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? data.category : c)),
        )
      } else {
        setCategories((prev) => [data.category, ...prev])
      }

      handleCloseModal()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Error al eliminar')
        return
      }

      setCategories((prev) => prev.filter((c) => c.id !== id))
    } catch (error) {
      captureException(error)
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('es-UY')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <button
          onClick={() => handleOpenModal()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800"
        >
          Nueva Categoría
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Slug
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
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatDate(category.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenModal(category)}
                      className="mr-2 px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      data-testid="delete-category"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Nombre
                </label>
                <input
                  type="text"
                  data-testid="category-form-name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                    if (fieldErrors.slug)
                      setFieldErrors((prev) => ({ ...prev, slug: '' }))
                  }}
                  className={`w-full rounded-md border px-3 py-2 ${
                    fieldErrors.slug ? 'border-red-500' : 'border-zinc-300'
                  }`}
                  required
                />
                {fieldErrors.slug && (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.slug}
                  </p>
                )}
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
                  data-testid="category-form-submit"
                  disabled={saving}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

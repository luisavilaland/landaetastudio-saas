'use client'

import { useState } from 'react'
import { captureException } from '@sentry/nextjs'

type ShippingMethod = {
  id: string
  name: string
  description: string | null
  price: number
  freeShippingThreshold: number | null
  estimatedDaysMin: number | null
  estimatedDaysMax: number | null
  isActive: string | null
  sortOrder: number | null
  createdAt: Date
  updatedAt: Date
}

export function ShippingMethodsTable({
  initialMethods,
}: {
  initialMethods: ShippingMethod[]
}) {
  const [shippingMethods, setShippingMethods] = useState(initialMethods)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(
    null,
  )
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    freeShippingThreshold: null as number | null,
    estimatedDaysMin: null as number | null,
    estimatedDaysMax: null as number | null,
    isActive: true,
    sortOrder: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const handleOpenModal = (method?: ShippingMethod) => {
    if (method) {
      setEditingMethod(method)
      setFormData({
        name: method.name,
        description: method.description || '',
        price: method.price,
        freeShippingThreshold: method.freeShippingThreshold,
        estimatedDaysMin: method.estimatedDaysMin,
        estimatedDaysMax: method.estimatedDaysMax,
        isActive: method.isActive === 'true',
        sortOrder: method.sortOrder ?? 0,
      })
    } else {
      setEditingMethod(null)
      setFormData({
        name: '',
        description: '',
        price: 0,
        freeShippingThreshold: null,
        estimatedDaysMin: null,
        estimatedDaysMax: null,
        isActive: true,
        sortOrder: 0,
      })
    }
    setError('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingMethod(null)
    setFormData({
      name: '',
      description: '',
      price: 0,
      freeShippingThreshold: null,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
      isActive: true,
      sortOrder: 0,
    })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const url = editingMethod
        ? `/api/shipping/${editingMethod.id}`
        : '/api/shipping'

      const method = editingMethod ? 'PUT' : 'POST'

      const body: Record<string, unknown> = { ...formData }
      if (!body.description) delete body.description
      if (!body.freeShippingThreshold) delete body.freeShippingThreshold
      if (!body.estimatedDaysMin) delete body.estimatedDaysMin
      if (!body.estimatedDaysMax) delete body.estimatedDaysMax

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al guardar')
        setSaving(false)
        return
      }

      if (editingMethod) {
        setShippingMethods((prev) =>
          prev.map((m) => (m.id === editingMethod.id ? data.method : m)),
        )
      } else {
        setShippingMethods((prev) => [data.method, ...prev])
      }

      handleCloseModal()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este método de envío?')) return

    try {
      const res = await fetch(`/api/shipping/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Error al eliminar')
        return
      }

      setShippingMethods((prev) => prev.filter((m) => m.id !== id))
    } catch (error) {
      captureException(error)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead className="bg-zinc-100">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
              Nombre
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
              Precio
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
              Envío Gratis
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
              Días Estimados
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
              Estado
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-zinc-600">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {shippingMethods.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                No hay métodos de envío. Crea el primero.
              </td>
            </tr>
          ) : (
            shippingMethods.map((method) => (
              <tr key={method.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-sm">{method.name}</td>
                <td className="px-4 py-3 text-sm">
                  {formatPrice(method.price)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {method.freeShippingThreshold
                    ? formatPrice(method.freeShippingThreshold)
                    : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {method.estimatedDaysMin && method.estimatedDaysMax
                    ? `${method.estimatedDaysMin}-${method.estimatedDaysMax} días`
                    : method.estimatedDaysMin
                      ? `${method.estimatedDaysMin} días`
                      : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      method.isActive === 'true' || method.isActive === null
                        ? 'bg-green-100 text-green-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {method.isActive === 'true' || method.isActive === null
                      ? 'Activo'
                      : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleOpenModal(method)}
                    className="mr-2 px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(method.id)}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {editingMethod ? 'Editar Método' : 'Nuevo Método de Envío'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                  rows={2}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Precio (centavos) *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      price: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                  min="0"
                  required
                />
                <p className="mt-1 text-xs text-zinc-500">Ej: 150 = $1.50</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Umbral de envío gratis (centavos)
                </label>
                <input
                  type="number"
                  value={formData.freeShippingThreshold || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      freeShippingThreshold: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                  min="0"
                  placeholder="Opcional"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Si el total del carrito &gt;= este valor, el envío es gratis.
                  Ej: 1000 = $10.00
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Días mínimos
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedDaysMin || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        estimatedDaysMin: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                    min="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Días máximos
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedDaysMax || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        estimatedDaysMax: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Orden
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      sortOrder: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                  min="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm text-zinc-700">
                  Método activo
                </label>
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

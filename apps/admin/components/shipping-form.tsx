'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createShippingMethodSchema } from '@repo/validation'

type Props = {
  mode?: 'create' | 'edit'
  initialData?: {
    id?: string
    name?: string
    description?: string | null
    price?: number
    freeShippingThreshold?: number | null
    estimatedDaysMin?: number | null
    estimatedDaysMax?: number | null
    isActive?: boolean
    sortOrder?: number
  }
}

export function ShippingForm({ mode = 'create', initialData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price ? initialData.price / 100 : '',
    freeShippingThreshold: initialData?.freeShippingThreshold
      ? initialData.freeShippingThreshold / 100
      : '',
    estimatedDaysMin: initialData?.estimatedDaysMin ?? '',
    estimatedDaysMax: initialData?.estimatedDaysMax ?? '',
    isActive: initialData?.isActive ?? true,
    sortOrder: initialData?.sortOrder ?? 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: Math.round(Number(form.price) * 100),
      freeShippingThreshold: form.freeShippingThreshold
        ? Math.round(Number(form.freeShippingThreshold) * 100)
        : undefined,
      estimatedDaysMin: form.estimatedDaysMin
        ? Number(form.estimatedDaysMin)
        : undefined,
      estimatedDaysMax: form.estimatedDaysMax
        ? Number(form.estimatedDaysMax)
        : undefined,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
    }

    const validation = createShippingMethodSchema.safeParse(payload)

    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ')
      setError(issues)
      setLoading(false)
      return
    }

    try {
      const url =
        mode === 'edit' && initialData?.id
          ? `/api/shipping/${initialData.id}`
          : '/api/shipping'
      const method = mode === 'edit' ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar método de envío')
      }

      router.push('/shipping')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar método de envío',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">
        {mode === 'edit' ? 'Editar Método de Envío' : 'Nuevo Método de Envío'}
      </h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700"
          >
            Nombre
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none"
            placeholder="Envío estándar"
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
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none"
            rows={3}
            placeholder="Descripción del método de envío..."
          />
        </div>

        <div>
          <label
            htmlFor="price"
            className="block text-sm font-medium text-zinc-700"
          >
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
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none"
            placeholder="199.00"
          />
        </div>

        <div>
          <label
            htmlFor="freeShippingThreshold"
            className="block text-sm font-medium text-zinc-700"
          >
            Envío gratis a partir de (UYU, opcional)
          </label>
          <input
            id="freeShippingThreshold"
            type="number"
            step="0.01"
            min="0"
            value={form.freeShippingThreshold}
            onChange={(e) =>
              setForm({ ...form, freeShippingThreshold: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none"
            placeholder="1000.00"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="estimatedDaysMin"
              className="block text-sm font-medium text-zinc-700"
            >
              Días mínimos (opcional)
            </label>
            <input
              id="estimatedDaysMin"
              type="number"
              min="0"
              value={form.estimatedDaysMin}
              onChange={(e) =>
                setForm({ ...form, estimatedDaysMin: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none"
              placeholder="2"
            />
          </div>

          <div>
            <label
              htmlFor="estimatedDaysMax"
              className="block text-sm font-medium text-zinc-700"
            >
              Días máximos (opcional)
            </label>
            <input
              id="estimatedDaysMax"
              type="number"
              min="0"
              value={form.estimatedDaysMax}
              onChange={(e) =>
                setForm({ ...form, estimatedDaysMax: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none"
              placeholder="5"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="sortOrder"
            className="block text-sm font-medium text-zinc-700"
          >
            Orden (opcional)
          </label>
          <input
            id="sortOrder"
            type="number"
            min="0"
            value={form.sortOrder}
            onChange={(e) =>
              setForm({ ...form, sortOrder: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-zinc-500 focus:outline-none"
            placeholder="0"
          />
        </div>

        <div className="flex items-center">
          <input
            id="isActive"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
          />
          <label
            htmlFor="isActive"
            className="ml-2 block text-sm text-zinc-700"
          >
            Activo
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/shipping')}
            className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Tenant = {
  id: string
  slug: string
  name: string
  customDomain: string | null
  plan: string | null
  status: string | null
  createdAt: Date
}

export function TenantsTable({ initialTenants }: { initialTenants: Tenant[] }) {
  const router = useRouter()
  const [tenants, setTenants] = useState(initialTenants)
  const [error, setError] = useState('')

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este tenant?')) return

    try {
      setError('')
      const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al eliminar tenant')
        return
      }
      setTenants((prev) => prev.filter((t) => t.id !== id))
    } catch {
      setError('Error de conexión al eliminar tenant')
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('es-UY')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <button
          onClick={() => router.push('/tenants/new')}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800"
        >
          Crear Tenant
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full" data-testid="tenant-table">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Dominio
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Plan
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">
                Estado
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
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No hay tenants. Crea el primero.
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-sm">{tenant.slug}</td>
                  <td className="px-4 py-3 text-sm">{tenant.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {tenant.customDomain || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        tenant.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatDate(tenant.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => router.push(`/tenants/${tenant.id}/edit`)}
                      className="mr-2 px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(tenant.id)}
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
  )
}

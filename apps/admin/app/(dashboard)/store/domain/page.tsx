'use client'

import { useState, useEffect } from 'react'
import { captureException } from '@sentry/nextjs'

type DomainStatus = 'not_configured' | 'pending' | 'verified'

type TenantInfo = {
  id: string
  slug: string
  customDomain: string | null
}

export default function DomainPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [customDomain, setCustomDomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchTenant()
  }, [])

  const fetchTenant = async () => {
    try {
      const res = await fetch('/api/config/tenant')
      const data = await res.json()
      if (res.ok) {
        setTenant(data)
        setCustomDomain(data.customDomain || '')
      } else {
        setError(data.error || 'Error al cargar tenant')
      }
    } catch (err) {
      captureException(err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/config/tenant/domain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customDomain: customDomain.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al guardar')
        return
      }

      setSuccess('Dominio guardado correctamente')
      fetchTenant()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      captureException(err)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(
        `/api/domain-check?domain=${encodeURIComponent(customDomain.trim())}`,
      )
      const data = await res.json()

      if (res.ok && data.available) {
        setSuccess('Dominio verificado y disponible')
      } else if (res.ok && !data.available) {
        setError('El dominio ya está en uso. Elige otro dominio.')
      } else {
        setError(
          'No se pudo verificar el dominio. Asegúrate de que el DNS apunte correctamente.',
        )
      }
    } catch (err) {
      setError('Error al verificar el dominio')
    } finally {
      setVerifying(false)
    }
  }

  const getStatusDisplay = (): { text: string; color: string } => {
    if (!customDomain || !tenant?.customDomain) {
      return { text: 'No configurado', color: 'text-zinc-500' }
    }
    return { text: 'Configurado', color: 'text-green-600' }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    )
  }

  if (error && !tenant) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  const status = getStatusDisplay()

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dominio Personalizado</h1>
      </div>

      <div className="space-y-6 rounded-lg border bg-white p-6">
        <div>
          <h2 className="mb-2 text-lg font-medium">Estado del dominio</h2>
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${status.color} bg-zinc-50`}
          >
            {status.text}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="customDomain"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Dominio personalizado
            </label>
            <input
              id="customDomain"
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              placeholder="mitienda.com.uy"
            />
            <p className="mt-1 text-sm text-zinc-500">
              Ingresa tu dominio sin http:// (ej. mitienda.com.uy)
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar dominio'}
            </button>
            {customDomain && (
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying}
                className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-50 disabled:opacity-50"
              >
                {verifying ? 'Verificando...' : 'Verificar ahora'}
              </button>
            )}
          </div>
        </form>

        <div className="border-t pt-6">
          <h2 className="mb-4 text-lg font-medium">Configuración de DNS</h2>
          <div className="space-y-3 rounded-md bg-zinc-50 p-4">
            <p className="text-sm text-zinc-700">
              Para usar tu dominio personalizado, configura los siguientes
              registros DNS:
            </p>
            <div className="rounded border bg-white p-3">
              <p className="text-sm font-medium text-zinc-700">
                Registro CNAME
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-zinc-600">
                  <span className="rounded bg-zinc-100 px-1 font-mono">
                    Nombre/Host:
                  </span>{' '}
                  www (o @ para el dominio raíz)
                </p>
                <p className="text-sm text-zinc-600">
                  <span className="rounded bg-zinc-100 px-1 font-mono">
                    Valor/Destino:
                  </span>{' '}
                  tusaas.com
                </p>
                <p className="text-sm text-zinc-600">
                  <span className="rounded bg-zinc-100 px-1 font-mono">
                    TTL:
                  </span>{' '}
                  3600 (o el valor por defecto)
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Nota: Si usas Vercel en producción, el valor debe ser el dominio
              de tu despliegue (ej. mi-tienda.vercel.app)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

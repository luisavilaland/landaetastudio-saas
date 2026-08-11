'use client'

import { useState, useRef } from 'react'

type ImportResult = {
  row: number
  name: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

type ImportSummary = {
  total: number
  created: number
  skipped: number
  errors: number
}

export function CSVImport({
  onImportComplete,
}: {
  onImportComplete: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [results, setResults] = useState<ImportResult[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Seleccioná un archivo CSV')
      return
    }

    setUploading(true)
    setError('')
    setSummary(null)
    setResults([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al importar')
        return
      }

      setSummary(data.summary)
      setResults(data.results)

      if (data.summary.created > 0) {
        onImportComplete()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const downloadTemplate = () => {
    const csv =
      'name,slug,description,price,stock,status,category_slug,sku\nRemera Básica,remera-basica,Remera de algodón,2500,10,active,remeras,remera-basica-001'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'productos-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        Importar CSV
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Importar productos desde CSV
              </h2>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setSummary(null)
                  setResults([])
                  setError('')
                }}
                className="text-xl text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            {/* Instrucciones */}
            <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
              <p className="mb-1 font-medium">Columnas del CSV:</p>
              <p>
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  name
                </span>
                ,{' '}
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  price
                </span>
                ,{' '}
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  stock
                </span>{' '}
                — obligatorios
              </p>
              <p className="mt-1">
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  slug
                </span>
                ,{' '}
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  description
                </span>
                ,{' '}
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  status
                </span>
                ,{' '}
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  category_slug
                </span>
                ,{' '}
                <span className="rounded bg-zinc-200 px-1 font-mono text-xs">
                  sku
                </span>{' '}
                — opcionales
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                El precio va en centavos (ej: 2500 = $25.00). Status: active,
                draft o archived.
              </p>
            </div>

            <button
              onClick={downloadTemplate}
              className="mb-4 block text-sm text-blue-600 hover:underline"
            >
              ↓ Descargar template de ejemplo
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="mb-4 block w-full rounded-lg border border-zinc-300 p-2 text-sm text-zinc-600"
            />

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            {/* Resumen */}
            {summary && (
              <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-sm">
                <p className="mb-2 font-medium">Resultado de la importación:</p>
                <div className="flex gap-4">
                  <span className="text-green-600">
                    ✓ {summary.created} creados
                  </span>
                  <span className="text-amber-600">
                    ⊘ {summary.skipped} omitidos
                  </span>
                  <span className="text-red-600">
                    ✗ {summary.errors} errores
                  </span>
                </div>
              </div>
            )}

            {/* Detalle de errores */}
            {results.filter((r) => r.status !== 'created').length > 0 && (
              <div className="mb-4 max-h-40 space-y-1 overflow-y-auto text-xs">
                {results
                  .filter((r) => r.status !== 'created')
                  .map((r, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 rounded p-1 ${r.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
                    >
                      <span>Fila {r.row}:</span>
                      <span className="font-medium">{r.name}</span>
                      <span>— {r.reason}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setSummary(null)
                  setResults([])
                  setError('')
                }}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800"
              >
                Cerrar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {uploading ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { Suspense } from 'react'
import { SearchResults } from './search-results'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Buscar productos',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>
}) {
  const params = await searchParams
  const query = params.q || ''
  const offset = parseInt(params.offset || '0')

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">
        Resultados de búsqueda
      </h1>
      {query && (
        <p className="mb-6 text-zinc-600">
          Buscando: <span className="font-medium">{query}</span>
        </p>
      )}
      <Suspense fallback={<div className="py-8 text-center">Buscando...</div>}>
        <SearchResults query={query} offset={offset} />
      </Suspense>
    </div>
  )
}

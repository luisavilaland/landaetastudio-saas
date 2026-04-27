import { Suspense } from "react";
import { SearchResults } from "./search-results";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buscar productos",
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; offset?: string };
}) {
  const query = searchParams.q || "";
  const offset = parseInt(searchParams.offset || "0");

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-2">
        Resultados de búsqueda
      </h1>
      {query && (
        <p className="text-zinc-600 mb-6">
          Buscando: <span className="font-medium">{query}</span>
        </p>
      )}
      <Suspense fallback={<div className="text-center py-8">Buscando...</div>}>
        <SearchResults query={query} offset={offset} />
      </Suspense>
    </div>
  );
}

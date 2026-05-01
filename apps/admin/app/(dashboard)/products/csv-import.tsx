"use client";

import { useState, useRef } from "react";

type ImportResult = {
  row: number;
  name: string;
  status: "created" | "skipped" | "error";
  reason?: string;
};

type ImportSummary = {
  total: number;
  created: number;
  skipped: number;
  errors: number;
};

export function CSVImport({ onImportComplete }: { onImportComplete: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Seleccioná un archivo CSV");
      return;
    }

    setUploading(true);
    setError("");
    setSummary(null);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al importar");
        return;
      }

      setSummary(data.summary);
      setResults(data.results);

      if (data.summary.created > 0) {
        onImportComplete();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const csv = "name,slug,description,price,stock,status,category_slug,sku\nRemera Básica,remera-basica,Remera de algodón,2500,10,active,remeras,remera-basica-001";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm rounded-md hover:bg-zinc-50"
      >
        Importar CSV
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Importar productos desde CSV</h2>
              <button onClick={() => { setIsOpen(false); setSummary(null); setResults([]); setError(""); }}
                className="text-zinc-400 hover:text-zinc-600 text-xl">✕</button>
            </div>

            {/* Instrucciones */}
            <div className="bg-zinc-50 rounded-lg p-3 mb-4 text-sm text-zinc-600">
              <p className="font-medium mb-1">Columnas del CSV:</p>
              <p><span className="font-mono text-xs bg-zinc-200 px-1 rounded">name</span>, <span className="font-mono text-xs bg-zinc-200 px-1 rounded">price</span>, <span className="font-mono text-xs bg-zinc-200 px-1 rounded">stock</span> — obligatorios</p>
              <p className="mt-1"><span className="font-mono text-xs bg-zinc-200 px-1 rounded">slug</span>, <span className="font-mono text-xs bg-zinc-200 px-1 rounded">description</span>, <span className="font-mono text-xs bg-zinc-200 px-1 rounded">status</span>, <span className="font-mono text-xs bg-zinc-200 px-1 rounded">category_slug</span>, <span className="font-mono text-xs bg-zinc-200 px-1 rounded">sku</span> — opcionales</p>
              <p className="mt-1 text-xs text-zinc-500">El precio va en centavos (ej: 2500 = $25.00). Status: active, draft o archived.</p>
            </div>

            <button onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:underline mb-4 block">
              ↓ Descargar template de ejemplo
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="block w-full text-sm text-zinc-600 border border-zinc-300 rounded-lg p-2 mb-4"
            />

            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

            {/* Resumen */}
            {summary && (
              <div className="mb-4 p-3 rounded-lg bg-zinc-50 text-sm">
                <p className="font-medium mb-2">Resultado de la importación:</p>
                <div className="flex gap-4">
                  <span className="text-green-600">✓ {summary.created} creados</span>
                  <span className="text-amber-600">⊘ {summary.skipped} omitidos</span>
                  <span className="text-red-600">✗ {summary.errors} errores</span>
                </div>
              </div>
            )}

            {/* Detalle de errores */}
            {results.filter(r => r.status !== "created").length > 0 && (
              <div className="max-h-40 overflow-y-auto mb-4 text-xs space-y-1">
                {results.filter(r => r.status !== "created").map((r, i) => (
                  <div key={i} className={`flex gap-2 p-1 rounded ${r.status === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    <span>Fila {r.row}:</span>
                    <span className="font-medium">{r.name}</span>
                    <span>— {r.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setIsOpen(false); setSummary(null); setResults([]); setError(""); }}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800">
                Cerrar
              </button>
              <button onClick={handleUpload} disabled={uploading}
                className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-800 disabled:opacity-50">
                {uploading ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

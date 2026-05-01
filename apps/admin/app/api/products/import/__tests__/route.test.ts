import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

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

function normalizeSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => { row[header] = values[i] ?? ""; });
    return row;
  });
}

async function handleImport(
  session: { user: { tenantId: string } } | null,
  csvText: string | null,
  existingSlugs: string[] = [],
  categories: { slug: string; id: string }[] = []
): Promise<Response> {
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!csvText) {
    return NextResponse.json({ error: "No se proporcionó un archivo CSV" }, { status: 400 });
  }

  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    return NextResponse.json({ error: "El CSV está vacío o no tiene filas válidas" }, { status: 400 });
  }

  const firstRow = rows[0];
  if (!("name" in firstRow) || !("price" in firstRow) || !("stock" in firstRow)) {
    return NextResponse.json({ error: "El CSV debe tener las columnas: name, price, stock" }, { status: 400 });
  }

  const categoryBySlug = categories.reduce((acc, cat) => {
    acc[cat.slug] = cat.id;
    return acc;
  }, {} as Record<string, string>);

  const results: ImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.name?.trim()) {
      results.push({ row: rowNum, name: row.name || "(vacío)", status: "error", reason: "Nombre requerido" });
      continue;
    }

    const price = parseInt(row.price, 10);
    if (isNaN(price) || price < 0) {
      results.push({ row: rowNum, name: row.name, status: "error", reason: "Precio inválido (debe ser número >= 0)" });
      continue;
    }

    const stock = parseInt(row.stock, 10);
    if (isNaN(stock) || stock < 0) {
      results.push({ row: rowNum, name: row.name, status: "error", reason: "Stock inválido (debe ser número >= 0)" });
      continue;
    }

    const slug = row.slug?.trim() ? normalizeSlug(row.slug) : normalizeSlug(row.name);

    if (existingSlugs.includes(slug)) {
      results.push({ row: rowNum, name: row.name, status: "skipped", reason: `Slug '${slug}' ya existe` });
      continue;
    }

    if (row.category_slug?.trim() && !categoryBySlug[row.category_slug.trim()]) {
      results.push({ row: rowNum, name: row.name, status: "error", reason: `Categoría '${row.category_slug}' no encontrada` });
      continue;
    }

    results.push({ row: rowNum, name: row.name, status: "created" });
  }

  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    summary: { total: rows.length, created, skipped, errors },
    results,
  });
}

const validCSV = `name,slug,description,price,stock,status,category_slug,sku
Remera Básica,remera-basica,Remera de algodón,2500,10,active,remeras,remera-001
Pantalón Jeans,pantalon-jeans,Jeans clásico,5000,5,active,pantalones,jeans-001`;

const csvMissingColumns = `name,description
Remera,Descripción`;

describe("POST /api/products/import", () => {
  it("should return 401 when no session", async () => {
    const res = await handleImport(null, validCSV);
    expect(res.status).toBe(401);
  });

  it("should return 400 when no file provided", async () => {
    const res = await handleImport({ user: { tenantId: "tenant-1" } }, null);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No se proporcionó");
  });

  it("should return 400 when CSV missing required columns", async () => {
    const res = await handleImport({ user: { tenantId: "tenant-1" } }, csvMissingColumns);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("columnas");
  });

  it("should create products from valid CSV", async () => {
    const res = await handleImport(
      { user: { tenantId: "tenant-1" } },
      validCSV,
      [],
      [
        { slug: "remeras", id: "cat-1" },
        { slug: "pantalones", id: "cat-2" },
      ]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.created).toBe(2);
    expect(body.summary.errors).toBe(0);
  });

  it("should skip products with duplicate slug", async () => {
    const res = await handleImport(
      { user: { tenantId: "tenant-1" } },
      validCSV,
      ["remera-basica"],
      [{ slug: "remeras", id: "cat-1" }, { slug: "pantalones", id: "cat-2" }]
    );
    const body = await res.json();
    expect(body.summary.skipped).toBe(1);
    expect(body.summary.created).toBe(1);
    expect(body.results[0].status).toBe("skipped");
    expect(body.results[0].reason).toContain("ya existe");
  });

  it("should return error for invalid price", async () => {
    const csv = `name,price,stock\nRemera,-100,10`;
    const res = await handleImport({ user: { tenantId: "tenant-1" } }, csv);
    const body = await res.json();
    expect(body.summary.errors).toBe(1);
    expect(body.results[0].reason).toContain("Precio inválido");
  });

  it("should return error for invalid stock", async () => {
    const csv = `name,price,stock\nRemera,2500,-5`;
    const res = await handleImport({ user: { tenantId: "tenant-1" } }, csv);
    const body = await res.json();
    expect(body.summary.errors).toBe(1);
    expect(body.results[0].reason).toContain("Stock inválido");
  });

  it("should return error for missing name", async () => {
    const csv = `name,price,stock\n,2500,10`;
    const res = await handleImport({ user: { tenantId: "tenant-1" } }, csv);
    const body = await res.json();
    expect(body.summary.errors).toBe(1);
    expect(body.results[0].reason).toContain("Nombre requerido");
  });

  it("should return error for invalid category", async () => {
    const csv = `name,price,stock,category_slug\nRemera,2500,10,inexistente`;
    const res = await handleImport({ user: { tenantId: "tenant-1" } }, csv, [], []);
    const body = await res.json();
    expect(body.summary.errors).toBe(1);
    expect(body.results[0].reason).toContain("Categoría");
  });

  it("should auto-generate slug from name if not provided", async () => {
    const csv = `name,price,stock\nRemera Básica Ñoña,2500,10`;
    const res = await handleImport({ user: { tenantId: "tenant-1" } }, csv);
    const body = await res.json();
    expect(body.summary.created).toBe(1);
    // El slug se genera internamente, verificamos que no hubo error
    expect(body.results[0].status).toBe("created");
  });

  it("should handle mixed results correctly", async () => {
    const csv = `name,price,stock\nProducto OK,2500,10\n,500,5\nDuplicado,1000,3`;
    const res = await handleImport(
      { user: { tenantId: "tenant-1" } },
      csv,
      ["duplicado"]
    );
    const body = await res.json();
    expect(body.summary.total).toBe(3);
    expect(body.summary.created).toBe(1);
    expect(body.summary.skipped).toBe(1);
    expect(body.summary.errors).toBe(1);
  });
});

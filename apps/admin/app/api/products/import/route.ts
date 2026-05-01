import { NextRequest, NextResponse } from "next/server";
import { db, dbProducts, dbProductVariants, dbCategories } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

type CSVRow = {
  name: string;
  slug: string;
  description?: string;
  price: string;
  stock: string;
  status?: string;
  category_slug?: string;
  sku?: string;
};

type ImportResult = {
  row: number;
  name: string;
  status: "created" | "skipped" | "error";
  reason?: string;
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

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] ?? "";
    });
    return row as CSVRow;
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "No se proporcionó un archivo CSV" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "El archivo debe ser un CSV" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "El CSV está vacío o no tiene filas válidas" },
        { status: 400 }
      );
    }

    // Validar headers requeridos
    const firstRow = rows[0];
    if (!("name" in firstRow) || !("price" in firstRow) || !("stock" in firstRow)) {
      return NextResponse.json(
        { error: "El CSV debe tener las columnas: name, price, stock" },
        { status: 400 }
      );
    }

    // Cargar categorías del tenant para resolver category_slug
    const categories = await db
      .select()
      .from(dbCategories)
      .where(eq(dbCategories.tenantId, tenantId));

    const categoryBySlug = categories.reduce((acc, cat) => {
      acc[cat.slug] = cat.id;
      return acc;
    }, {} as Record<string, string>);

    const results: ImportResult[] = [];
    const now = new Date();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 porque la fila 1 es el header

      // Validaciones básicas
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
      const sku = row.sku?.trim() || slug;

      // Verificar slug duplicado
      const existing = await db
        .select()
        .from(dbProducts)
        .where(and(eq(dbProducts.slug, slug), eq(dbProducts.tenantId, tenantId)))
        .limit(1);

      if (existing.length > 0) {
        results.push({ row: rowNum, name: row.name, status: "skipped", reason: `Slug '${slug}' ya existe` });
        continue;
      }

      // Resolver categoría
      let categoryId: string | null = null;
      if (row.category_slug?.trim()) {
        categoryId = categoryBySlug[row.category_slug.trim()] || null;
        if (!categoryId) {
          results.push({ row: rowNum, name: row.name, status: "error", reason: `Categoría '${row.category_slug}' no encontrada` });
          continue;
        }
      }

      // Crear producto y variante en transacción
      try {
        await db.transaction(async (tx) => {
          const [product] = await tx
            .insert(dbProducts)
            .values({
              tenantId,
              name: row.name.trim(),
              slug,
              description: row.description?.trim() || null,
              imageUrl: null,
              status: row.status?.trim() || "draft",
              categoryId,
              metadata: {},
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          await tx.insert(dbProductVariants).values({
            tenantId,
            productId: product.id,
            sku,
            price,
            stock,
            options: {},
            createdAt: now,
            updatedAt: now,
          });
        });

        results.push({ row: rowNum, name: row.name, status: "created" });
      } catch (err) {
        results.push({ row: rowNum, name: row.name, status: "error", reason: "Error al guardar en base de datos" });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      summary: { total: rows.length, created, skipped, errors },
      results,
    }, { status: 200 });

  } catch (error) {
    console.error("Error importing CSV:", error);
    return NextResponse.json(
      { error: "Error al procesar el archivo CSV" },
      { status: 500 }
    );
  }
}

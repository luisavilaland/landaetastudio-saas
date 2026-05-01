/**
 * Normaliza un string para ser usado como slug:
 * - Convierte a minúsculas
 * - Elimina acentos (normalización Unicode NFD)
 * - Reemplaza caracteres no alfanuméricos (excepto guiones y espacios) por string vacío
 * - Reemplaza espacios por guiones
 * - Reemplaza múltiples guiones consecutivos por uno solo
 * - Elimina guiones al principio y al final
 */
export function normalizeSlug(text: string): string {
  return text
    // Convertir a minúsculas
    .toLowerCase()
    // Normalización Unicode NFD para descomponer caracteres acentuados
    .normalize("NFD")
    // Eliminar diacríticos (caracteres combinantes)
    .replace(/[\u0300-\u036f]/g, "")
    // Reemplazar caracteres no alfanuméricos (excepto guiones y espacios) por string vacío
    .replace(/[^a-z0-9\s-]/g, "")
    // Reemplazar espacios por guiones
    .replace(/\s+/g, "-")
    // Reemplazar múltiples guiones consecutivos por uno solo
    .replace(/-+/g, "-")
    // Eliminar guiones al principio y al final
    .replace(/^-+|-+$/g, "");
}

# Vault de Obsidian

Este vault es la base de conocimiento del proyecto. Contiene la documentación, decisiones, historial y especificaciones que pueden consultarse y mantenerse desde el repositorio, incluso sin Obsidian instalado.

## Estructura del vault

### Contenido human-curated (convención 00-05)

- `00_Inbox/` — capturas rápidas.
- `01_ADRs/` — decisiones arquitectónicas.
- `02_Bitacora/bitacora.md` — bitácora append-only.
- `03_Deuda/deuda-tecnica.md` — ítems de deuda.
- `04_Fases/` — auditorías y cierres de fase.
- `05_Specs/` — arquitectura, brief, blueprint.

### Contenido tool-managed

- `engram/` — exportaciones de Engram (auto-generado por
  `pnpm vault:export`). NO editar manualmente; se sobrescribe en
  cada export. El archivo `.engram-sync-state.json` es cache local
  y está en `.gitignore`.

Para exportar/refrescar: `pnpm vault:export`.

## Convenciones

- Los ADRs se guardan en `01_ADRs/`.
- La bitácora del proyecto se guarda en `02_Bitacora/bitacora.md` y es **append-only**: solo se agregan entradas al final, nunca se editan las existentes.
- La deuda técnica se guarda en `03_Deuda/deuda-tecnica.md`.

## Integraciones

- El vault se abre con Obsidian, pero sus archivos son Markdown plano.
- Engram se exporta con `pnpm vault:export` (ver "Contenido tool-managed").

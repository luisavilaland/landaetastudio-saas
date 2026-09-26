# Documentación — índice

Este directorio conserva solo lo que herramientas del proyecto
leen programáticamente:

- `migrations-archive/` — historial de migraciones pre-baseline
  (leído por `scripts/check-migrations.sh`).
- `superpowers/` — plans y specs operativos de Paseo.

La documentación narrativa se migró al vault de Obsidian (`vault/`):

- ADRs → `vault/01_ADRs/`
- Bitácora → `vault/02_Bitacora/bitacora.md`
- Deuda técnica → `vault/03_Deuda/deuda-tecnica.md`
- Auditorías → `vault/04_Fases/`
- Arquitectura, brief, blueprint → `vault/05_Specs/`
- Memoria de Engram → `vault/engram/` (tool-managed, sin numeración)

Para abrir el vault: Obsidian → File → Open folder as vault →
seleccionar `vault/`.

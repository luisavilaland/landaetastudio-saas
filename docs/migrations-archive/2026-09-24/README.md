# Archivo de migraciones pre-baseline (2026-09-24)

Historial de migraciones anterior al baseline. Se archivó porque:
- Los archivos 0000-0004 no existían en disco (journal sin .sql).
- Los snapshots 0003, 0004, 0009, 0010 no existían.
- El tracking en public.__drizzle_migrations estaba incompleto (solo 0014 y 0015).
- El script db:migrate corría drizzle-kit up en vez de migrate.

Decisión (aprobada por luisavilaland): reset con baseline limpio. Ver ítem 24 de vault/03_Deuda/deuda-tecnica.md.

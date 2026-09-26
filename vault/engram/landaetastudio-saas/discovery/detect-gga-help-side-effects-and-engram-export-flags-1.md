---
id: 1
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/gga-engram-discovery
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-25 12:08:51"
updated_at: "2026-09-25 12:08:51"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Detect GGA help side effects and Engram export flags"
---

# Detect GGA help side effects and Engram export flags

**What**: Descubrí que GGA v2.10.1 ignora `--help`: `gga init --help` creó `.gga` en el proyecto y `gga install --help` instaló `.git/hooks/pre-commit`; Engram v2.2.0 expone `obsidian-export` con `--vault`, `--project`, `--all`, `--limit`, `--since`, `--force`, `--graph-config`, `--watch` e `--interval`, pero tampoco acepta `--help` directamente.
**Why**: Fase A solicitó descubrir flags y formatos sin modificar el repositorio.
**Where**: proyecto `C:\\Users\\exodo\\Documents\\saas-ecommerce`; artefactos accidentales `.gga` y `.git/hooks/pre-commit`; docs consultadas en `C:\\Users\\exodo\\AppData\\Local\\Temp\\gentleman-guardian-angel`.
**Learned**: No ejecutar GGA para consultar ayuda en esta versión; usar el repositorio/docs o `gga help`. Los cambios accidentales no fueron revertidos y requieren autorización explícita.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-tooling]]

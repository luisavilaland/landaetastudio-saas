---
id: 173
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 16:13:38"
updated_at: "2026-10-06 16:13:38"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Deuda: _journal.json idx 2 con when fechados 90 dias en el futuro"
---

# Deuda: _journal.json idx 2 con when fechados 90 dias en el futuro

**What**: La entrada `idx: 2` de `packages/db/migrations/meta/_journal.json` tiene `when: 1799110400000`, que equivale a **2027-01-05T00:53:20Z**: 90 dias en el futuro respecto del trabajo real (2026-10-06). Es error mio: puse el valor a ojo en vez de la hora real.

**Why**: Luis lo marco como "punto menor a confirmar" y ordeno no bloquear el merge de #199 por esto. Se registra como deuda para el proximo PR de migraciones.

**Where**: `packages/db/migrations/meta/_journal.json`, entrada `idx: 2`, tag `0002_resolve_tenant_by_preapproval`.

**Learned**:
- **No rompe nada.** drizzle-kit ordena y aplica por `idx`, no por `when`. El orden `idx 0 < 1 < 2` es correcto y la migracion esta aplicada en la DB. Es cosmetico.
- **Pero se propaga.** `drizzle-kit generate` usa el `when` de la ultima entrada para timestampar la nueva. Con una ultima entrada fechada en 2027, toda migracion futura nace con `when` > 2027 y el error crece.
- **El `when` correcto** para 2026-10-06 15:44 UTC era ~1799111040000 (el `when` debe ser posterior al `idx 1` de 2026-10-03).
- **No editar `_journal.json` retroactivamente** como regla general (AGENTS.md): cambiar una entrada existente puede hacer que drizzle intente re-aplicar migraciones ya aplicadas. Para esta entrada en concreto el riesgo es bajo porque `when` no participa del orden, pero la forma segura de corregirlo es hacerlo explicito y verificado, no de rebote.
- Referencia: los otros `when` son coherentes: idx 0 = 2026-09-24, idx 1 = 2026-10-03.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]

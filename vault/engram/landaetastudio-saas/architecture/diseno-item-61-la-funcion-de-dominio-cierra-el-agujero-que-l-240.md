---
id: 240
type: architecture
project: landaetastudio-saas
scope: project
topic_key: architecture/invariante-cross-tenant-item-61
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 21:58:02"
updated_at: "2026-10-08 21:58:02"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Diseno item 61: la funcion de dominio cierra el agujero que los tipos no cierran"
---

# Diseno item 61: la funcion de dominio cierra el agujero que los tipos no cierran

**What**: Diseño del item 61 (H-T6-1) escrito en `vault/04_Fases/diseno-item-61-cross-tenant.md`. Sin implementacion. Registrados los items 89 (GGA no revisa `.mjs`) y 90 (CJK no detectado). Ref corregido a H-T6-1.

**Why**: Los tests con mock no pueden observar el `WHERE` de una query. Quitar `eq(dbSubscriptions.tenantId, ...)` del `UPDATE` de `applyTransition` deja la suite verde: la auditoria T6 lo demostro con mutaciones reales (53 passed en las dos).

**Where**: `vault/04_Fases/diseno-item-61-cross-tenant.md`, `vault/03_Deuda/deuda-tecnica.md` (items 89, 90), `vault/02_Bitacora/bitacora.md`.

**Learned**:
- **El brief musculaba un tipo y el problema no es el tipo.** `TenantFilteredRow<T>` y branded `TenantId` mueven la responsabilidad a donde el typecheck la vigila, pero **el test sigue sin poder verificar el `WHERE`**: con `withTenantContext` mockeado, ninguna asercion observa la query. Los dos dejan abierto el agujero que la auditoria demostro. La opcion que si lo cierra es una **funcion de dominio que posee el read y el write**, porque se testea contra Neon con dos tenants reales: ahi el `WHERE` deja de ser invisible porque hay filas de verdad.
- **Un branded type NO detecta este bug.** El defecto es *borrar* una expresion, y TypeScript no puede marcar la presencia de una expresion dentro de un `.where()` compuesto. Un `TenantId` correctamente branded sigue compilando si `eq(tenantId, ...)` desaparece. Previene otro bug (pasar un tenant arbitrario) que es real, pero no es este item.
- **`subscriptions_tenant_idx` es UNIQUE sobre `tenantId`** (`schema.ts:91`): hay exactamente una suscripcion por tenant. La fuga no es "una fila entre muchas", es **la fila del otro tenant y solo esa**.
- **Ref: H-T6-1, no H-F2-1.** `H-F2-1` es el item 62. Segunda vez en tres PRs que el ref del brief no coincide con la fuente. La primera (H-F2-2 vs H-F2-6) paso inadvertido al remoto porque no verifique antes de commitear; esta se verifico primero.
- **Alcance real: 31 call sites** de `withTenantContext` en 24 archivos (admin 11/19, storefront 9/12, commerce 4/6), 12 tablas con `tenantId: uuid('tenantId')` plano, cero wrappers de tipos existentes.
- **El hook que valida las reglas no revisa los scripts que las implementan** (item 89): GGA cubre `*.ts,*.tsx,*.js,*.jsx,*.sql`; `check-encoding.mjs` es `.mjs`, asi que el PR #231 paso sin revision de codigo. Ampliar el patron tiene riesgo: el reviewer devuelve formato de TypeScript.
- **El repo reconoce el problema del CJK y lo mitiga con disciplina, no con control automatico** (item 90): el item 40 tiene un snippet manual de escaneo y el detector de CI no lo cubre. `bitacora.md` tiene 12 CJK: L976/L977 son el documento del incidente del item 52, **L3910 parece corrupcion real** ("con el viejo" + 2 CJK). Mismo patron que el `?` del item 87: el detector no puede cubrir la categoria sin falsos positivos.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-architecture]]

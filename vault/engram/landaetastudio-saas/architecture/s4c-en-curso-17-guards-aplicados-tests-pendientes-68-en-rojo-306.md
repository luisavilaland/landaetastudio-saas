---
id: 306
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 17:43:00"
updated_at: "2026-10-14 17:43:00"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "S4c en curso: 17 guards aplicados, tests pendientes (68 en rojo)"
---

# S4c en curso: 17 guards aplicados, tests pendientes (68 en rojo)

**What**: S4c (issue #253) arranca: helper `getPermissions` + 17 guards aplicados en 13 endpoints. Commits: faa4343 (helper). Los guards NO estan commiteados todavia.

**Why**: Item 103 (CRITICO de la auditoria #257): deriveTenantPermissions no lo leia nadie que pudiera rechazar una request.

**Where**: packages/commerce/src/tenant-permissions.ts (nuevo, commiteado); apps/admin/lib/permission-guard.ts y apps/storefront/lib/permission-guard.ts (nuevos, SIN commitear); 13 route.ts de apps/ modificados (SIN commitear); packages/test-utils/src/index.ts (doc, SIN commitear).

**Learned**:
- **Contingencia de tipo en la especificacion**: Luis pidio `canAccessPanel: false` como default sin acceso, pero el campo es `PanelAccess` ('full'|'limited'|'readonly'|'none'), NO booleano. Seria error de compilación. El default se llama NO_ACCESS con `canAccessPanel: 'none'`.
- **Tenant sin suscripcion NO es NO_ACCESS**: se asume 'pending_first_payment' porque el item 96 exige que el onboarding pueda entrar a configurar branding ANTES de pagar. Devolver sin acceso romperia el alta.
- **El patron de guard propuesto (insertar dentro del withTenantContext existente) NO funciona en 4 handlers**: usan el callback para RETORNAR DATOS, no una NextResponse. Y en products POST el upload a R2 ocurre ANTES de la transaccion -> un guard adentro deja el objeto huerfano. Por eso se creo `denyIfNoPermission(tenantId, permiso)` que devuelve `NextResponse | null` y se llama antes de cualquier efecto.
- **Tipocheck 9/9 verde con los 17 guards.** Tests: 68 fallan (esperado: el guard deniega y los mocks no simulan tenant+suscripcion).
- **Opcion C (makeTxMock por tabla) NO es viable**: el mock devuelve SIEMPRE el mismo objeto `tx` para toda cadena (`mockReturnValue(tx)` x16, sin cadenas por llamada). Resolver por tabla exige un objeto distinto por select() = reescritura del nucleo de un helper usado por 27 archivos. Se eligio B.
- **El prefijo de selects es mas traicionero de lo que parece**: insertar `[{status:'active'}, terminal:'limit']` x2 al principio hace que el 3er select (el chequeo de slug del handler) lea una fila de categoria y devuelva 409 donde se esperaba 201. Los datos del guard NO deben confundirse con los del handler. SE REVIRTIERON los 13 archivos de test: quedaron como en HEAD.
- **Error propio**: `tenant-permissions.test.ts` YA EXISTIA (test de deriveTenantPermissions). Lo sobreescribi sin darme cuenta. Se resolvio moviendo esos describes a subscription-permissions.test.ts — lo cual ademas cierra el hallazgo de naming de la auditoria.
- `@repo/test-utils` NO es dependencia de `@repo/commerce` y ningun test del paquete la usa: el mock del helper se escribio local.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]

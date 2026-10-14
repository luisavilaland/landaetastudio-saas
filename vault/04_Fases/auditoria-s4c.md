# Auditoría S4c — Aplicación de guards

**Issue:** #261 · **Ref:** PR #260, item 103 · **Base:** `e246ee1`
**Fecha:** 2026-10-14 · **Worktree:** `audit/s4c`

## Resumen ejecutivo

| Métrica | Resultado |
| --- | --- |
| Guards verificados | **16 / 16** |
| Property del guard | **16 / 16 se sostiene** (el 403 viene del guard, no de otra línea) |
| Deny tests reales | **7 / 16** — los otros 9 no tienen ninguno |
| Instancias del bug de GGA | **0** |
| Decisiones de producto | **5 / 5 correctas** |
| Endpoints de escritura sin clasificar | **0** |
| Hallazgos nuevos | **5 abiertos + 1 corregido en este PR** |

**Veredicto: S4c APROBADO con reservas.** La propiedad de seguridad se sostiene
en los 16 call sites: nadie pasa por un endpoint protegido sin el permiso. Pero
la **cobertura de tests solo llega a 7 de 16**, así que la mitad de los guards
puede desaparecer sin que CI lo note. El control funciona; su red de seguridad
no.

## Metodología

- 2 subagentes en paralelo con scopes disjuntos, sobre un worktree de Paseo con
  `pnpm install` real (typecheck 9/9 como prueba de que no era un junction).
- **@QA:** mutación sobre código de producción. Nunca sobre archivos de test.
- **@Orquestador:** verificación estructural y de producto, read-only.
- 4 familias de mutación: **B1** comentar el guard · **B2** commenting en los
  sitios sin deny test · **B3a** forzar deny · **B4** forzar allow.
- Verificación del worktree al terminar: `git status` limpio, 16 guards
  intactos, ambos `permission-guard.ts` sin residuos.

## Verificación de la property

Los tests mockean `getPermissions` (la fuente), no el guard. Por eso borrar la
línea del guard rompe el test: el endpoint sigue llamando al guard real.

| # | Call site | Línea | Permiso | Deny test | Guard quitado | Evidencia |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | products POST | 71 | canWrite | ✅ ×3 | **falla** | B1 · B3a→403 · B4 |
| 2 | categories POST | 42 | canWrite | ✅ | **falla** | B1 · B3a→403 · B4 |
| 3 | categories/[id] PUT | 67 | canWrite | ❌ | pasa en silencio | B3a→403 |
| 4 | categories/[id] DELETE | 178 | canWrite | ❌ | pasa en silencio | B3a→403 |
| 5 | orders/[id] PUT | 160 | **canSell** | ✅ | **falla** | B1 · B3a→403 · B4 |
| 6 | products/import POST | 73 | canWrite | ❌ | 500 accidental | B3a→403 |
| 7 | products/[id] PUT | 123 | canWrite | ✅ | **falla** | B1 · B3a→403 · B4 |
| 8 | products/[id] DELETE | 639 | canWrite | ❌ | pasa en silencio | B3a→403 |
| 9 | variants POST | 82 | canWrite | ❌ | pasa en silencio | B3a→403 |
| 10 | images POST | 78 | canWrite | ❌ | 500 accidental | B3a→403 |
| 11 | images/[imageId] DELETE | 28 | canWrite | ❌ | 500 accidental | B3a→403 |
| 12 | shipping POST | 42 | canWrite | ✅ | **falla** | B1 · B3a→403 · B4 |
| 13 | shipping/[id] PUT | 66 | canWrite | ❌ | pasa en silencio | B3a→403 |
| 14 | shipping/[id] DELETE | 142 | canWrite | ❌ | pasa en silencio | B3a→403 |
| 15 | checkout POST | 85 | canSell | ✅ | **falla** | B1 · B4 |
| 16 | checkout/preference POST | 106 | canSell | ✅ (+body) | **falla** | B1 · B4 |

**Totales:** B1 = 10 fallos esperados (9 deny + la regresión de `tenantId`).
B3a = 44/45 recibieron 403 real. B4 = exactamente los 9 deny tests fallaron,
los otros 71 pasaron.

**Corrección de transcripción:** el reporte de @QA listó `orders/[id]` PUT como
`canWrite`. Es **`canSell`** (`route.ts:160`). El reparto real es **3 call sites
con `canSell`** (orders PUT, checkout POST, preference POST) y **13 con
`canWrite`**.

### El hallazgo que importa

**9 de 16 no tienen deny test, y 6 de esos 9 fallan en silencio absoluto.**
Borrar su guard no rompe nada en CI. Los 3 restantes (import, images, imageId)
solo fallan con un **500 por acoplamiento de `callCount`** — el guard consume la
transacción #1 de la cola del mock, así que el test se rompe por la posición,
no por una aserción de 403. Es cobertura que **parece** existir.

## Búsqueda del patrón del bug de GGA

GGA encontró que `products/[id]` PUT ejecutaba el guard con `tenantId = ''`.

| Métrica | Resultado |
| --- | --- |
| Sitios donde `tenantId` se escribe antes del guard | **16 / 16** |
| Instancias del patrón defectuoso | **0** |

Los 2 que una heurística marcó (`checkout`, `checkout/preference`) son
correctos: resuelven por subdominio con `getTenantId()`, sin `auth()`. Verificados
a mano — `getTenantId()` en L78 / L97, null-check, guard en L85 / L106,
efectos después.

**Early returns:** ninguno ejecuta efectos tenant-scoped ni devuelve datos antes
de su guard. B3a lo corrobora en runtime: los tests del path de validación
recibieron 403, o sea el guard precede incluso a la validación en `import`.

## Decisiones de producto — las 5 correctas

| Decisión | Veredicto | Evidencia |
| --- | --- | --- |
| `config/settings` sin guard | **CORRECTA** | `config/settings/route.ts:64-117` — solo escribe `tenants.settings` (JSONB cosmético). Sin precios, stock ni SKUs. |
| `config/tenant/branding` sin guard | **CORRECTA** | `:24-111` — sube logo a R2 y escribe `tenants.logoUrl`. Progresividad R5: si R2 falla responde 200 sin logo. |
| `orders/[id]` con `canSell` | **CORRECTA** | `:160`. `past_due` tiene `canSell: true` / `canWrite: false` (`subscription-permissions.ts:154-165`). Un tenant en gracia **debe** poder marcar "enviado": el comprador no falló el pago. |
| `shipping` con `canWrite` | **CORRECTA** | Coherente con products, categories, variants, images. Bloquea métodos de envío durante la gracia. |
| `subscriptions/*` y `webhooks/*` sin guard | **CORRECTA** | `past_due` no puede cancelar (`canCancel: false`, L161) pero `paused` sí (L176) — decisión de producto del 2026-10-04, documentada en `cancel/route.ts:15-19`. El webhook de plataforma usa `MP_PLATFORM_WEBHOOK_SECRET`, no auth de tenant. |

**Endpoints de escritura sin clasificar: 0.** Los 31 endpoints de escritura
inventariados están todos cubiertos por las 5 decisiones o son públicos por
diseño (cart con cookie anónima, register, register-tenant, webhooks con HMAC).

## Estructura

- **El helper NO duplica lógica de negocio.** `tenant-permissions.ts` es un
  adaptador fino estado→permisos y **delega en `deriveTenantPermissions`** (L100).
  La matriz vive una sola vez.
- **`denyIfNoPermission` sí está duplicado** (admin + storefront),
  intencionalmente: unificarlos obligaría a exponer `NextResponse` en el paquete
  de dominio, que es una violación de capa. No divergen.

## Hallazgos

| Severidad | ID | Título |
| --- | --- | --- |
| **ALTO** | H-F3-s4c-1 | 9 de 16 guards no tienen deny test; 6 pasan en silencio |
| **MEDIO** | H-F3-s4c-2 | `derivePermissions` no tira con estadosprototype (`constructor`, `toString`, `__proto__`) |
| **MEDIO** | H-F3-s4c-3 | `shipping/[id].test.ts` es un toy: nunca importa la ruta real |
| **BAJO** | H-F3-s4c-4 | Comentario engañoso en `shipping/[id]/route.test.ts`: promete un assert de 403 que no existe |
| **BAJO** | H-F3-s4c-5 | Falta un control que prevenga el bug de `tenantId` sin inicializar |
| **INFO** | H-F3-s4c-6 | Conteo propagado 17 → 16 en 4 documentos (**corregido en este PR**) |
| **INFO** | H-F3-s4c-7 | `config/tenant/domain` sin guard no está en la lista explícita de decisiones |

### H-F3-s4c-2 en detalle

`derivePermissions('constructor')` devuelve una `Function` en vez de tirar.
`deriveTenantPermissions('active', 'constructor')` también. Los tests solo
cubren estados desconocidos ordinarios (`mystery_status`), que sí tiran.

**No hay escalación de privilegios:** `Function.canWrite` es `undefined`, así
que el guard cae a 403. El contrato documentado ("estado desconocido = fallar
ruidosamente") está violado, pero el fallo es cerrado. Agrava que
`subscriptions.status` es `text` **sin CHECK constraint** (schema L101): este
mapa de TypeScript es el único validador.

## Lo que NO amerita ítem

**El flake de Redis no se reproduce.** 2 de 2 suite completas pasaron. El test
es hermético (mockea `ioredis`, sin red); los warnings
`Redis unavailable, degrading gracefully` vienen del código de producción
ejercitado por **otros** tests (rate limit de checkout), no del test de redis.
Si reaparece, mirar `isolate: true` en la config de vitest.

## Recomendación

1. **Denegaciones para los 9 sitios** (H-F3-s4c-1). Prioridad alta: es la
   diferencia entre un control que existe y uno que está probado. Asertar 403,
   no aceptar el 500 accidental.
2. **Endurecer los lookups** con `Object.hasOwn` o `Map`, y agregar un CHECK
   constraint sobre `subscriptions.status` (H-F3-s4c-2).
3. **Reescribir el toy test** de `shipping/[id]` importando la ruta real, y
   borrar el comentario aspiracional (H-F3-s4c-3, H-F3-s4c-4).
4. **Regla ESLint** que exija `tenantId` inicializado antes de
   `denyIfNoPermission` (H-F3-s4c-5). Costo ~15 min, previene la clase de bug
   que GGA encontró.

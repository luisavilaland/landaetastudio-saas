---
id: 280
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-10 19:06:23"
updated_at: "2026-10-10 19:06:23"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "ENABLE_DEFAULT_TENANT_FALLBACK ausente de developmentSchema no produce warning"
---

# ENABLE_DEFAULT_TENANT_FALLBACK ausente de developmentSchema no produce warning

**What**: Luis planteo en el review de PR #245 que `ENABLE_DEFAULT_TENANT_FALLBACK` esta en `productionSchema` pero no en `developmentSchema`, y que eso podria producir un warning de "variable desconocida" en dev. Verificado read-only: NO es un problema. `coreSchema`, `productionSchema` y `developmentSchema` son `z.object({...})` sin `.strict()`, asi que Zod 4.6.5 hace STRIP de las claves no declaradas: las ignora en silencio, sin rechazar y sin loguear warning.

**Why**: cerrar el punto antes de que quede como debt item sin verificar, y evitar un fix innecesario que cierre los schemas y rompa Preview.

**Where**: `packages/validation/src/env.ts`, `apps/storefront/proxy.ts`.

**Learned**:
(1) **No existe "warning de variable desconocida" en este codigo.** `formatValidationError` solo imprime `result.error.issues`, y un strip no produce issues. Cero output.
(2) **Aun asi, declararla en `developmentSchema` es el fix correcto** (3 lineas). Motivo concreto: el schema documenta las variables que el codigo lee, y hay dos que no estan en ninguna parte: `DEFAULT_TENANT_SLUG` y `ENABLE_DEFAULT_TENANT_FALLBACK` se leen en `proxy.ts` sin aparecer en ningun schema. Con la variable ausente del schema, un typo en `.env.local` (`ENABLE_DEFAULT_TENANT_FALLBACck`) es indistinguible de la variable bien puesta: el gate queda apagado y nadie lo sabe.
(3) **NO cambiar a `.strict()` seria un error.** El repo depende de variables que Zod no ve como propias pero Next.js si necesita: `NODE_ENV` y los `_` de prefijo que Next inyecta. Un `.strict()` sobre `process.env` falla por motivos que no tienen que ver con este bug. Se verifico: `.strict()` con una clave extra da `success: false`.
(4) **La asimetria actual no es inocua en Preview.** `hasCloudVars` es `NODE_ENV === 'production' && (R2 || RESEND || UPSTASH)`. En Preview con credenciales cloud presentes se cae a `productionSchema`, entonces una Preview sin el gate declarado pasa. Con la variable declarada en los dos schemas, el comportamiento es explicito en los tres entornos.
(5) El gate lee `process.env` directo (`proxy.ts:171`), no pasa por `validateEnv`. Por eso el escenario de fallo es "queda apagado en silencio", no "la app no arranca".
(6) `z.literal('true').optional()` da `success: false` con valor `'1'`, lo que confirma que el fail-closed del gate esta bien implementado del lado del schema en prod.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]

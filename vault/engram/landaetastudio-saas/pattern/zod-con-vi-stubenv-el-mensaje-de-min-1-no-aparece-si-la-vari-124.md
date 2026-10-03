---
id: 124
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 16:03:51"
updated_at: "2026-10-03 16:03:51"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Zod con vi.stubEnv: el mensaje de min(1) no aparece si la variable falta"
---

# Zod con vi.stubEnv: el mensaje de min(1) no aparece si la variable falta

**What**: Al testear schemas de Zod con vi.stubEnv, un assert que matchea solo el nombre de la variable puede pasar por el motivo equivocado. Hay que exigir el encabezado de contexto ademas del nombre.

**Why**: En T2 los asserts de produccion para MP_PLATFORM_* matcheaban /MP_PLATFORM_ACCESS_TOKEN/ y pasaban. Al endurecerlos para exigir el mensaje propio de min(1, MP_PLATFORM_ACCESS_TOKEN is required in production), fallaron: cuando la variable FALTA, Zod emite el error de tipo expected string, received undefined. El mensaje custom de min(1) solo aparece cuando la variable existe pero es una cadena vacia o muy corta.

**Where**: packages/validation/src/__tests__/env.test.ts, packages/validation/src/env.ts

**Learned**: (1) En este archivo todos los schemas usan .min(1, mensaje propio), asi que el mensaje custom nunca se ve para una variable ausente. Un test que lo exija esta probando el caso equivocado. (2) El assert correcto es /Invalid environment variables for PRODUCTION:[\s\S]*MP_PLATFORM_ACCESS_TOKEN/, que exige el encabezado de contexto mas el nombre: eso descarta que el fallo venga del schema de desarrollo. (3) Para probar la rama de produccion hay que setear NODE_ENV=production Y al menos una cloud var (R2_ENDPOINT, RESEND_API_KEY o UPSTASH_REDIS_REST_URL), porque isProduction los exige a los dos. (4) Regla general: un assert debe distinguishing el fallo que busca de cualquier otro fallo que el mismo schema pueda producir.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]

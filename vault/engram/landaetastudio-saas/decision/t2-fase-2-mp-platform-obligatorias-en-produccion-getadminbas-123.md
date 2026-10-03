---
id: 123
type: decision
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 16:03:05"
updated_at: "2026-10-03 16:03:05"
revision_count: 1
tags:
  - landaetastudio-saas
  - decision
aliases:
  - "T2 Fase 2: MP_PLATFORM_* obligatorias en produccion + getAdminBaseUrl"
---

# T2 Fase 2: MP_PLATFORM_* obligatorias en produccion + getAdminBaseUrl

**What**: MP_PLATFORM_ACCESS_TOKEN y MP_PLATFORM_WEBHOOK_SECRET salieron de coreSchema y pasaron a ser obligatorias en productionSchema; en developmentSchema quedan opcionales. Se creo apps/admin/lib/get-admin-base-url.ts con getAdminBaseUrl(request), espejo de getStorefrontBaseUrl.

**Why**: T2 del plan de Fase 2 (issue 166). Sin esas credenciales los handlers de suscripciones no pueden cobrar ni validar la firma del webhook. Se mantienen opcionales en desarrollo para que la app arranque y los handlers devuelvan 500 MercadoPago no configurado en vez de romper el boot.

**Where**: packages/validation/src/env.ts, packages/validation/src/__tests__/env.test.ts, apps/admin/lib/get-admin-base-url.ts, apps/admin/lib/__tests__/get-admin-base-url.test.ts, SETUP.md

**Learned**: (1) RIESGO DE DEPLOY: volver obligatorias estas dos variables significa que una app de Vercel sin MP_PLATFORM_* deja de arrancar. Hay que configurarlas en los TRES proyectos de Vercel antes de mergear. (2) getAdminBaseUrl lanza si falta el header host, a diferencia del espejo del storefront que devuelve https:// ; una URL con la forma correcta pero host vacio registraria el webhook en un destino que nunca recibe nada. (3) getAdminBaseUrl parsea x-forwarded-proto como lista separada por comas porque Vercel envia esa forma. (4) En develop no hay riesgo porque isProduction exige NODE_ENV=production mas al menos una cloud var (SETUP.md documenta el trap de UPSTASH vs REDIS_URL). (5) Verificado tras pnpm db:seed en Neon: plans 3, tenants 2, subscriptions 2, products 6, orders 4, customers 2; el indice de T1 sigue presente y 0 filas con mpPreapprovalId. (6) El seed trunca 10 tablas y NO trunca subscriptions explicitamente: depende del CASCADE desde TRUNCATE TABLE tenants, que es el contenido del item 46 de deuda tecnica.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]

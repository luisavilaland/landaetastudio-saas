---
id: 119
type: discovery
project: landaetastudio-saas
scope: project
topic_key: fase2/p1-hipotesis-webhooks
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 14:36:05"
updated_at: "2026-10-03 14:36:05"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "H2 descartada: topics de MP suscritos manualmente, P1 queda en H1"
---

# H2 descartada: topics de MP suscritos manualmente, P1 queda en H1

**What**: H2 (falta de topics suscritos en el panel de MP) queda DESCARTADA. El 2026-10-02 Luis marcó manualmente todos los topics en el panel de MercadoPago — `subscription_preapproval`, `subscription_authorized_payment` y `payment` legacy — y completó el wizard "Configura tu integración". Los webhooks de suscripciones siguen sin llegar con topics activos. El panel sigue mostrando "ETAPA 1 DE 5", que se interpreta como cosmético o bug del panel de MP, no como señal de topics sin suscribir.

**Why**: El spike T0 concludes H3 sin haber descartado H1 ni H2. Descartar H2 es lo que obliga a聲 reframear P1: la única hipótesis viva es H1 (MP no entrega a preview domains de Vercel), que igual solo se prueba con T5 desplegado en `admin.landaetastudio.com`. H3 (polling, T9) sigue como fallback condicional, no implementado.

**Where**: docs/superpowers/specs/2026-10-02-spike-t0-resultado.md §"Hipótesis alternativa" y tabla H1/H2/H3 (líneas 47-68, 130-135); docs/superpowers/plans/2026-10-01-fase2.md §reframe de T0 (líneas 66-90, "Secuencia obligatoria dentro de T5"); vault/02_Bitacora/bitacora.md líneas 2006-2007, 2095, 2123-2125, 2157. Los TRES documentos siguen diciendo que H2 está pendiente.

**Learned**: (1) El plan de Fase 2 tiene un gate explícito "H2 primero (5 min, BLOQUEANTE). No saltear el paso 1" — con H2 ya descartado ese paso está obsoleto y debe removerse o marcarse como ejecutado, o T5 arranca con un gate que ya se pagó. (2) La bitácora es append-only: la corrección de H2 va como entrada NUEVA con fecha, nunca editando las entradas del 2026-10-02/03 (AGENTS.md). (3) T1 no depende de P1 en ninguna forma: la migración del índice único parcial `subscriptions_mp_preapproval_idx` avanza sin阻塞. (4) "ETAPA 1 DE 5" no es evidencia fiable del estado de topics — no usarlo como signal en spikeos futuros.</content>
</invoke>

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-fase2]]

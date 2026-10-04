---
id: 135
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 22:36:10"
updated_at: "2026-10-03 22:36:10"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Corregidos 3 bugs: signo de prorrateo, centavos vs unidades, payerEmail del header"
---

# Corregidos 3 bugs: signo de prorrateo, centavos vs unidades, payerEmail del header

**What**: Tres correcciones hechas durante T4: (1) docstring de `ProrationResult.proratedAmountCents` invertido, (2) `transactionAmount` sin dividir por 100 en `POST /preapproval`, (3) `payerEmail` tomado de un header del cliente.

**Why**: (1) Decia "(>0, upgrade)" cuando la implementacion `(currentPrice - newPrice) * fraction` produce NEGATIVO en un upgrade; sin verificar contra el codigo, el endpoint de cambio de plan habria cobrado el signo invertido. (2) La API de MP espera el monto en la UNIDAD de la moneda, no en centavos: se mandaba 4900 en vez de 49, 100x de sobrecobro. (3) Permitia redirigir el cobro de un tenant a una casilla arbitraria.

**Where**:
- `packages/commerce/src/subscription-proration.ts` (docstring)
- `apps/admin/app/api/subscriptions/preapproval/route.ts`
- `apps/admin/lib/subscriptions/handlers.ts` (`requireAuthContext`)

**Learned**:
- **Centavos vs unidades**: los centavos son convencion interna nuestra (AGENTS.md). La conversion va en el BORDE de la API. Ojo con `updatePreapproval`: ya envuelve solo `transactionAmount` en `auto_recurring.transaction_amount`, asi que NO hay que pasarle `auto_recurring`.
- Regla general: el `payerEmail` (y cualquier dato que vaya a un tercero) sale del JWT, nunca de un header del request.
- Los tests de contrato en el borde de la API (cantidad, moneda, campos prohibidos) detectaron esto antes que cualquier test de integracion.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]

# Blueprint Técnico v2.6 — SaaS eCommerce

**Post v0.9.0 — Plan completo de implementación**

**Versión:** 2.6 Final
**Fecha:** Septiembre 2026
**Estado:** Para aprobación del equipo
**Confidencial**

> **Referencia vigente** — Última revisión: 2026-09-17.
> Si el código diverge de este doc, **actualizar en el mismo PR**.
> Ver también: ADR-023, ADR-024, ADR-025, `subscription-lifecycle.md`.

---

## 📌 Resumen ejecutivo

Este blueprint define el plan completo para llevar la plataforma desde v0.9.0 (core commerce estable) hasta el lanzamiento comercial completo con autoservicio de tenants, suscripciones, personalización, plantillas, cupones, banners, boletines y envíos.

## 🎯 Objetivo principal

Un comercio puede registrarse por sí mismo (sin intervención del superadmin), configurar su propia cuenta de MercadoPago, pagar su suscripción, elegir una plantilla, y tener su tienda online operativa en menos de 30 minutos.

**Alcance:** 10 fases, todas pre-lanzamiento. Estimación secuencial: 71 a 100 días hábiles (~3.5 a 5 meses). Con paralelización parcial de fases 5-9: 50-70 días hábiles (~2.5 a 3.5 meses).

**Fuera de alcance:** Multi-tienda, white-label, Enterprise, sincronización MercadoLibre, B2B nativo, POS físico, frontend personalizable avanzado.

---

## 💳 Arquitectura de pagos — Dos flujos independientes

La plataforma maneja dos flujos de pago completamente independientes, cada uno con su propia cuenta de MercadoPago, su propio webhook y su propio ciclo de vida.

| FLUJO | QUIÉN COBRA | CUENTA MP | WEBHOOK |
|-------|-------------|-----------|---------|
| Suscripciones | LandaetaStudio | Nuestra cuenta MP (`MP_PLATFORM_ACCESS_TOKEN`) | `/api/webhooks/mercadopago/subscriptions/:tenantId` |
| Órdenes de tienda | Tenant (clientes finales) | Cuenta MP del tenant (`tenant_mp_config.access_token`) | `/api/webhooks/mercadopago/:tenantId` |

### Puntos clave

- El `ACCESS_TOKEN` que el tenant ingresa es **exclusivamente para cobrar a sus propios clientes**, no para pagar la suscripción.
- La suscripción se cobra con nuestro token de plataforma (`MP_PLATFORM_ACCESS_TOKEN`).
- Los webhooks son distintos porque vienen de cuentas MP distintas.
- El `external_reference` de la suscripción lleva el `tenantId` para saber a quién activar.

---

## ✅ Decisiones aprobadas

| DECISIÓN | ESTADO | RESPONSABLE |
|----------|--------|-------------|
| 3 tiers: Starter (UYU 2.000/mes), Pro (UYU 4.000/mes), Business (UYU 8.000/mes) | ✅ Aprobado | Producto |
| Sin período de prueba. Pago antes de acceder al panel admin | ✅ Aprobado | Producto |
| Suscripciones a nuestra MP; órdenes de clientes a la MP del tenant | ✅ Aprobado | Técnico |
| RLS activo en todas las tablas nuevas | ✅ Aprobado | Técnico |
| Cifrado de tokens con pgcrypto + clave en `MP_TOKEN_ENCRYPTION_KEY` | ✅ Aprobado | Técnico |
| Cupones sin límite por tier (decisión actual, revisable) | ✅ Aprobado | Producto |
| Banners: superior + popup configurable + input de cupón en carrito | ✅ Aprobado | Producto |
| Boletines: con captura + envío completo. Límites por tier | ✅ Aprobado | Producto |
| Plantillas: 3 en Pro, 6 en Business. Cambiables cuando el tenant quiera | ✅ Aprobado | Producto |
| Personalización visual: colores, logo, tipografía sobre mismo layout | ✅ Aprobado | Producto |
| Moneda: UYU (MercadoPago soporta preapproval en UYU) | ✅ Verificado | Técnico |
| Multi-tienda, white-label, Enterprise, MercadoLibre, B2B: fuera de alcance | ❌ Fuera | Producto |

---

## 💰 Tiers definitivos

| PLAN | UYU/MES | PRODUCTOS | VARIANTES/PROD | ADMINS | PLANTILLAS | SUSCRIPTORES |
|------|---------|-----------|----------------|--------|------------|--------------|
| Starter | UYU 2.000 | 150 | Máx. 5 | 1 | 0 (base) | 250 |
| Pro | UYU 4.000 | 400 | Máx. 10 | 5 | 3 | 1.000 |
| Business | UYU 8.000 | Ilimitados | Ilimitadas | 10 | 6 | Ilimitados |

### Features por tier

| FEATURE | STARTER | PRO | BUSINESS |
|---------|---------|-----|----------|
| MP propio (ACCESS_TOKEN + WEBHOOK_SECRET) | ✅ | ✅ | ✅ |
| Personalización visual (colores, logo, tipografía) | ✅ | ✅ | ✅ |
| Banners (superior + popup) | ✅ | ✅ | ✅ |
| Cupones de descuento | ✅ | ✅ | ✅ |
| Métodos de envío configurables | ✅ | ✅ | ✅ |
| Importación CSV de productos | ✅ | ✅ | ✅ |
| Boletines (newsletter) | ✅ 250 | ✅ 1.000 | ✅ Ilimitados |
| Plantillas de tienda | Layout base | 3 plantillas | 6 plantillas |
| Dominio personalizado | ❌ | ✅ | ✅ |
| Analytics básico | ❌ | ✅ | ✅ |
| Soporte prioritario | ❌ | ✅ | ✅ |
| Ejecutivo de cuenta dedicado | ❌ | ❌ | ✅ |
| SLA respuesta 24hs | ❌ | ❌ | ✅ |

### Lógica de conteo

- **Productos:** el límite aplica a la tabla `products` (cada producto cuenta como 1, sin importar cuántas variantes tenga).
- **Variantes:** el límite aplica por producto individual.
- **Suscriptores:** límite a la tabla `newsletter_subscribers` (activos).
- **Plantillas:** Starter usa el layout base fijo. Pro y Business pueden cambiar cuando quieran.

---

## 🔄 Flujo de suscripciones — Ciclo de vida completo

### Estados de suscripción (5)

| ESTADO | CUÁNDO APLICA | ACCESO AL PANEL | TIENDA PÚBLICA |
|--------|---------------|-----------------|----------------|
| `pending_first_payment` | Se registró, aún no pagó | ❌ Bloqueado | ❌ No publicada |
| `active` | Al día | ✅ Completo | ✅ Funcionando |
| `past_due` | Pago falló (dentro de gracia de 7 días) | ⚠ Limitado | ✅ Funcionando |
| `cancelled` | Canceló voluntariamente | ⚠ Solo lectura hasta fin de período | ✅ Hasta fin de período |
| `expired` | Pasó gracia sin pagar | ❌ Bloqueado | ❌ Despublicada |

### Durante el período de gracia (7 días)

| ACCIÓN | ¿PERMITIDO? |
|--------|-------------|
| Acceder al panel de admin | ✅ Sí |
| Ver datos (productos, órdenes, config) | ✅ Sí |
| Crear/editar productos | ❌ No |
| Crear/editar categorías | ❌ No |
| Recibir órdenes | ✅ Sí |
| Gestionar órdenes | ✅ Sí |
| Configurar MP, envíos, etc. | ❌ No |
| Cambiar de plan | ❌ No |

### Secuencia temporal de la gracia

| DÍA | EVENTO | EMAIL | ESTADO |
|-----|--------|-------|--------|
| 0 | Pago falla | "Tu pago falló" | `past_due` |
| 3 | Recordatorio | "Tu suscripción vence pronto" | `past_due` |
| 5 | Último aviso | "Último aviso antes de suspensión" | `past_due` |
| 7 | Suspensión | "Tu cuenta fue suspendida" | `expired` |
| 90 | Borrado definitivo (no se envía) | — | — |

### Recuperación y cancelación

| ESCENARIO | COMPORTAMIENTO |
|-----------|----------------|
| Recuperación tras fallo | Automática al recibir `payment.created` de MP. El webhook reactiva la suscripción (`expired` → `active`). Sin acción manual del tenant. |
| Cancelación voluntaria | Al final del período pagado. Sigue activo hasta la fecha de renovación, luego pasa a `cancelled`. |
| Retención de datos | 90 días desde la suspensión. Luego se borra toda la información. |
| Cambio de plan | Upgrade y downgrade libres con prorrateo. Ej: Pro (4.000) día 1 → Business (8.000) día 15 = se acreditan 2.000, paga 6.000. |

### Emails al tenant (7)

| # | EVENTO | CUÁNDO |
|---|--------|--------|
| 1 | Bienvenida | Al registrarse |
| 2 | Pago confirmado | Al activarse la suscripción |
| 3 | Pago fallido | Al detectar el primer fallo |
| 4 | Recordatorio día 3 | 3 días después del fallo |
| 5 | Último aviso día 5 | 5 días después del fallo |
| 6 | Suscripción suspendida | Al día 7 |
| 7 | Suscripción cancelada | Al confirmar la cancelación |

### Webhook que nunca llega

El tenant ve "esperando confirmación de pago" con un botón "Ya pagué, verificar" que consulta la API de MP manualmente.
Reintento automático: cada 5 minutos durante 2 horas (24 intentos).
Después de 2 horas, solo queda el botón manual.

---

## 🔐 Variables de entorno nuevas

| VARIABLE | USO | ÁMBITO |
|----------|-----|--------|
| `MP_PLATFORM_ACCESS_TOKEN` | Token de nuestra cuenta MP para cobrar suscripciones | Vercel (todas las apps) |
| `MP_PLATFORM_WEBHOOK_SECRET` | Secret del webhook de suscripciones (nuestra cuenta) | Vercel (storefront) |
| `MP_TOKEN_ENCRYPTION_KEY` | Cifrar/descifrar tokens de tenants en la DB | Vercel (todas las apps) |

```bash
# Generar la clave de cifrado
openssl rand -base64 32
```

---

## 🗺 Hoja de ruta — 10 fases (todas pre-lanzamiento)

| # | FASE | DÍAS EST. | DEPENDENCIAS | ESTADO |
|---|------|-----------|--------------|--------|
| 1 | Modelo de datos (plans, subscriptions, mp_config) | 2-3 | — | ⏳ ARRANCAR |
| 2 | Webhook suscripciones + checkout dinámico | 3-4 | Fase 1 | Pendiente |
| 3 | Autoservicio (landing + registro + pago) | 5-7 | Fase 2 | Pendiente |
| 4 | Personalización visual + dominio + infraestructura | 5-7 | Fase 3 | Pendiente |
| 5 | Cupones y descuentos | 8-10 | Fase 3 | Pendiente |
| 6 | Banners (superior + popup) | 4-6 | Fase 4 | Pendiente |
| 7 | Sistema de plantillas + 6 plantillas | 33-47 | Fase 4 | Pendiente |
| 8 | Boletines (captura + envío) | 5-7 | Fase 3 | Pendiente |
| 9 | Envíos (Correo Uruguayo + OCA) | 4-6 | Fase 3 | Pendiente |
| 10 | Go-live y checklist final | 2-3 | Fases 1-9 | Pendiente |

### Estimación

- **Secuencial:** 71 a 100 días hábiles (~3.5 a 5 meses).
- **Con paralelización de Fases 5-9** (todas dependen de Fase 3, no entre sí): 50 a 70 días hábiles (~2.5 a 3.5 meses).
- **Nota:** Fases 6 (banners) y 7 (plantillas) dependen de la Fase 4, no solo de la Fase 3.

---

## 🗄 Fase 1 — Modelo de datos ⏱ 2-3 días · ARRANCAR AHORA

**Objetivo:** Crear las tres tablas nuevas, aplicar RLS, y generar la migración con Drizzle ORM.

1. Agregar las tres tablas al schema de Drizzle en `packages/db/src/schema.ts`
2. Aplicar RLS `tenant_isolation` en `subscriptions` y `tenant_mp_config`
3. Ejecutar `pnpm db:generate` para generar la migración SQL
4. Ejecutar `pnpm db:migrate` para aplicar la migración en Neon
5. Insertar los tres planes en la tabla `plans` (UYU 2.000, 4.000, 8.000)
6. Asignar suscripción activa a los tenants existentes (tienda1, tienda2)
7. Agregar las 3 nuevas variables de entorno a Vercel

### Tabla `subscriptions` (con RLS)

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL, -- pending_first_payment | active | past_due | cancelled | expired
  current_period_end TIMESTAMPTZ NOT NULL,
  mp_preapproval_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

### Tabla `tenant_mp_config` (con RLS)

```sql
-- Credenciales del TENANT para cobrar a SUS clientes
-- (no se usa para cobrar la suscripción de la plataforma)
```

### Tabla `plans`

```sql
-- Se insertan los 3 planes: Starter (2.000), Pro (4.000), Business (8.000)
```

---

## 🔗 Fase 2 — Webhook suscripciones + checkout dinámico ⏱ 3-4 días

- **Checkout dinámico:** usar `tenant_mp_config.access_token` (descifrado) para órdenes de clientes finales. Si el tenant no tiene `mp_config` → error claro en el checkout.
- **Webhook de suscripciones:** `POST /api/webhooks/mercadopago/subscriptions/:tenantId`
- Usar `MP_PLATFORM_WEBHOOK_SECRET` para validar firma
- **Eventos:** `preapproval.created` (activar), `payment.created` (extender/reactivar), `preapproval.canceled` (cancelar)
- **Manejo de estados:** `past_due` → `active` al recibir pago exitoso
- **Tests:** unitarios + E2E con firma real

---

## 🚪 Fase 3 — Autoservicio (landing + registro + pago) ⏱ 5-7 días

**Flujo con dos cuentas MP:**

1. Tenant se registra (email, contraseña, nombre) → estado `pending_first_payment`
2. Tenant ingresa su propio MP (`ACCESS_TOKEN` + `WEBHOOK_SECRET`) → se guarda cifrado en `tenant_mp_config`
3. Plataforma cobra la suscripción usando nuestro `MP_PLATFORM_ACCESS_TOKEN` → crea preapproval con `external_reference = tenantId`
4. Webhook de suscripciones (con nuestro secret) confirma el pago → activa `subscriptions.status = 'active'`
5. Tenant accede al panel de admin

**Landing page pública:** mostrar planes y precios desde tabla `plans`
**Registro público con rate limiting:** 5 registros/hora por IP
**Validación del MP del tenant** con `/users/me`
**Panel de admin bloqueado** hasta `subscriptions.status = 'active'`
**UI "esperando confirmación de pago"** con botón "Ya pagué, verificar"
**Reintento automático** de verificación: cada 5 minutos por 2 horas

### Punto crítico

Sin el paso 4 (webhook), el tenant no puede entrar al panel aunque haya pagado. El flujo debe ser robusto con mensajes claros de error en cada paso y el botón de verificación manual como respaldo.

---

## 🎨 Fase 4 — Personalización visual + dominio + infraestructura ⏱ 5-7 días

- **Colores:** 3 variables CSS (primario, secundario, acento)
- **Logo:** subida a R2 (ya implementado)
- **Tipografía:** 5 fuentes predefinidas (Inter, Roboto, Montserrat, Playfair Display, Open Sans)
- **Infraestructura de banners:** definir `promo_banner` y `promo_popup` en `tenants.settings` (JSONB)
- **Dominio propio:** UI + validación DNS + integración con API de Vercel para SSL
- **Actualizar `proxy.ts`** del storefront para resolver por `customDomain`

---

## 🎟 Fase 5 — Cupones y descuentos ⏱ 8-10 días

- **Modelo de datos:** `coupons` + `coupon_usage` con RLS
- **Lógica:** validar cupón en `POST /api/checkout` antes de crear la preferencia de MP
- **Input de cupón** en el carrito (siempre requerido)
- **CRUD de cupones** en panel de admin con métricas de uso
- **Sin límite por tier** (decisión actual, revisable)
- **Tests:** unitarios + E2E

---

## 📢 Fase 6 — Banners (feature completa) ⏱ 4-6 días

- **Banner superior:** texto, link, color de fondo, visibilidad
- **Popup de promoción:** contenido, timing, visibilidad
- **UI en panel de admin** para configurar ambos
- **Componentes en storefront** que leen `tenants.settings` y renderizan

---

## 🏗 Fase 7 — Sistema de plantillas + 6 plantillas ⏱ 33-47 días

- **Infraestructura:** composiciones por plantilla + selector + resolución en runtime (4-6 días)
- **Plantilla 1:** refactor del layout actual (2-3 días)
- **Plantillas 2 a 6:** 5-7 días cada una
- Starter: layout base fijo. Pro: 3 plantillas. Business: 6 plantillas
- Los tenants pueden cambiar de plantilla cuando quieran

### Componentes compartidos

Los componentes (`ProductCard`, `CartDrawer`, `ProductGallery`) se escriben una vez. Cada plantilla define cómo se ordenan y qué layout usan. Esto permite mantener 6 plantillas sin duplicar componentes.

---

## 📧 Fase 8 — Boletines (captura + envío) ⏱ 5-7 días

- **Modelo de datos:** `newsletter_subscribers` + `newsletter_campaigns` con RLS
- **Formulario de captura:** en el storefront (footer o popup)
- **Doble opt-in:** email de confirmación con enlace único
- **Panel de admin:** suscriptores + exportar CSV + crear/enviar campañas
- **Integración con Resend Broadcasts:** envío masivo con tracking de bajas
- **Cumplimiento legal:** consentimiento + unsubscribe (Ley 18.331 Uruguay)
- **Límite por tier:** Starter 250, Pro 1.000, Business ilimitados

---

## 📦 Fase 9 — Envíos (Correo Uruguayo + OCA) ⏱ 4-6 días

- **Extender `shipping_methods`:** `provider` y `api_config` (JSONB)
- **Tabla `shipping_zones`:** zonas por país, tarifas y umbral de envío gratis
- **Integración con Correo Uruguayo / OCA:** cotización en tiempo real
- **Generación de etiquetas PDF** al confirmar la orden
- **UI en panel admin:** configurar zonas, proveedores y tarifas

---

## 🚀 Fase 10 — Go-live y checklist final ⏱ 2-3 días

1. Verificar flujo completo: registro → pago UYU → tienda activa
2. Verificar checkout con credenciales reales (`APP_USR-...`) de tenant de prueba
3. Verificar webhook de órdenes y suscripciones con eventos reales de MP
4. Verificar cupones, banners, boletines y plantillas end-to-end
5. Actualizar documentación: `README.md`, `SETUP.md`, `AGENTS.md`, `TESTING.md`
6. Crear `docs/runbook.md` para el equipo comercial y soporte
7. Primer cliente real onboardeado con el flujo de autoservicio

---

## ⚠ Riesgos y mitigaciones

| RIESGO | MITIGACIÓN |
|--------|------------|
| Fuga de tokens de MP si la base se filtra | Cifrado con pgcrypto. Clave en `MP_TOKEN_ENCRYPTION_KEY`, nunca en código ni DB. |
| Confusión entre los dos flujos de MP | Documentar claramente en el código con comentarios y en AGENTS.md. Variables separadas para cada flujo. |
| Abuso en el registro público | Rate limiting: 5 registros/hora por IP. |
| Webhook de suscripciones mal configurado | Reutilizar `verifyMercadoPagoSignature`. Fail-closed: si firma falla, rechazar. |
| Panel admin accesible sin suscripción activa | Middleware verifica `subscriptions.status` en cada request a `/admin/*`. |
| Tenant no recibe el webhook | UI "esperando confirmación" + botón "Ya pagué" + reintento automático cada 5 min por 2 horas. |
| Fase 7 (plantillas) se extiende | Paralelizar con Fases 8 y 9. Priorizar 3 plantillas de Pro primero. |
| Costos de Resend por boletines | Límite por tier (250/1.000/ilimitados). Monitorear uso mensual. |

---

## 🔮 Post-lanzamiento — Fuera de este blueprint

| FEATURE | DESCRIPCIÓN |
|---------|-------------|
| Multi-tienda | 1 tenant con múltiples tiendas. Requiere rediseño estructural del modelo de datos. |
| White-label | Agencias que revenden la plataforma con su propia marca. |
| Sincronización MercadoLibre | Stock y precios bidireccional. Panel unificado. |
| B2B nativo | Listas de precio, aprobaciones, crédito, pedidos mayoristas. |
| POS físico | App PWA sincronizada con inventario del ecommerce. |
| Analytics avanzado | Embudos, LTV, predicción de stock, cohorts. |
| Page builder avanzado | Secciones configurables drag & drop (opción E, ver abajo). |
| App mobile nativa | React Native / Expo con notificaciones push. |

### Frontend personalizable — Opciones evaluadas

| OPCIÓN | DESCRIPCIÓN | VIABILIDAD | ESTIMACIÓN |
|--------|-------------|------------|------------|
| A — Page builder visual | Editor tipo Shopify donde el tenant arrastra secciones | ⚠ Complejo | 3-6 meses |
| B — Inyección de código | El tenant pega HTML/CSS/JS propio | ❌ Descartado | — |
| C — Modo headless | API pública + frontend propio del tenant | ⚠ Solo para clientes técnicos | 2-3 meses |
| D — Work custom | Nuestro equipo construye a medida | ⚠ No es SaaS, es agencia | Variable |
| E — Secciones configurables | Secciones predefinidas que el tenant activa/desactiva y reordena | ✅ Alcanzable | 5-8 días |

### Por qué se descartó la Opción B

La inyección de código personalizado rompe la garantía de aislamiento entre tenants que construimos con RLS. Un tenant podría inyectar JS malicioso que afecte a otros, y el soporte se vuelve inviable.

### Recomendación

Si se decide ofrecer "frontend personalizable", la opción más equilibrada es la **E (secciones configurables)**. La **A (page builder)** solo si el mercado lo demanda y hay recursos para 3-6 meses.

---

## 📋 Pendientes antes de avanzar

**Requieren decisión del equipo:**

1. Confirmar las 5 fuentes de Google Fonts para Fase 4.
2. Aprobar mockups o wireframes de las 6 plantillas antes de Fase 7.
3. Definir los componentes compartidos entre plantillas (`ProductCard`, `CartDrawer`, `Navbar`, `Footer`).

**✅ Verificado y sin bloqueantes:**

- MercadoPago soporta preapproval en UYU.
- Los tiers están completamente definidos.
- El cifrado con pgcrypto es viable.
- El flujo de suscripciones está cerrado (5 estados, gracia de 7 días, retención de 90 días).

---

**Blueprint SaaS eCommerce v2.6 · Final**
**Septiembre 2026 · Confidencial · Para aprobación del equipo**

**Próximo paso: Fase 1 — Modelo de datos con Drizzle ORM**
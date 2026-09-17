# ADR-025: Sistema de plantillas intercambiables (composiciones, no frontends)

**Fecha:** 2026-09-17
**Autor:** Equipo LandaetaStudio
**Estado:** Aceptado

## Contexto

El blueprint v2.6 define que:
- **Starter** usa un layout base fijo.
- **Pro** tiene 3 plantillas disponibles.
- **Business** tiene 6 plantillas disponibles.
- Los tenants pueden cambiar de plantilla **cuando quieran**, sin intervención del superadmin.
- Las plantillas comparten componentes base (`ProductCard`, `CartDrawer`, `Navbar`, `Footer`, `ProductGallery`) pero definen distinto layout y composición de páginas.

El desafío: mantener 6 plantillas sin duplicar código de componentes, permitiendo cambios en caliente por tenant.

## Decisión

**Sistema de composiciones (template compositions)** en lugar de frontends separados o page builder:

### Arquitectura

1. **Componentes compartidos** (en `packages/ui` o `apps/storefront/components`):
   - `ProductCard`, `ProductGallery`, `CartDrawer`, `Navbar`, `Footer`, `CheckoutForm`, `Banner`, `NewsletterForm`, etc.
   - Cada componente es **agnóstico a la plantilla**: recibe props, renderiza UI. Sin lógica de "qué plantilla soy".

2. **Composiciones por plantilla** (en `apps/storefront/templates/[nombre-plantilla]/`):
   - Cada plantilla define **cómo se ordenan y ensamblan** los componentes en cada página.
   - Archivos de composición: `home.tsx`, `product.tsx`, `cart.tsx`, `checkout.tsx`, `category.tsx`, `search.tsx`.
   - Ejemplo: `templates/moderna/home.tsx` importa `Navbar`, `Hero`, `ProductGrid`, `Footer` y los ordena en un layout "hero + grid". `templates/minimalista/home.tsx` usa `Navbar`, `ProductGrid`, `Footer` (sin Hero).

3. **Resolución en runtime:**
   - `tenants.settings.template` guarda el nombre de la plantilla activa (ej: `moderna`, `minimalista`, `clasica`, `osca`, `natura`, `urbana`).
   - Middleware / Server Component lee `tenantId` → `template` → importa dinámicamente la composición correspondiente.
   - **Cambio en caliente:** El tenant actualiza `settings.template` → próxima request usa la nueva composición. Sin rebuild, sin deploy.

4. **Layout base (Starter):**
   - Plantilla `base` = composición por defecto. Starter no puede cambiarla (validación en API de settings).
   - Pro/Business: lista de plantillas permitidas por tier (validación en API).

### Estructura de archivos

```
apps/storefront/
├── components/           # Componentes compartidos (una sola implementación)
│   ├── ProductCard.tsx
│   ├── CartDrawer.tsx
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   └── ...
├── templates/
│   ├── base/             # Starter (layout base fijo)
│   │   ├── home.tsx
│   │   ├── product.tsx
│   │   ├── cart.tsx
│   │   └── checkout.tsx
│   ├── moderna/          # Pro + Business
│   │   ├── home.tsx
│   │   ├── product.tsx
│   │   ├── cart.tsx
│   │   └── checkout.tsx
│   ├── minimalista/      # Pro + Business
│   │   └── ...
│   ├── clasica/          # Pro + Business
│   ├── osca/             # Business
│   ├── natura/           # Business
│   └── urbana/           # Business
└── lib/templates.ts      # Resolución: getTemplateComposition(tenantId) → { home, product, cart, ... }
```

### Integración con Next.js App Router

Las páginas del App Router (`apps/storefront/app/.../page.tsx`) son **wrappers delgados** que no contienen lógica de layout:

1. Cada `page.tsx` (home, producto, carrito, checkout, categoría, búsqueda) recibe el `tenantId` vía `withTenantContext` o middleware.
2. Resuelve la plantilla activa: `const template = await getTemplate(tenantId)` (lee `tenants.settings.template`).
3. Hace **dynamic import** de la composición correspondiente usando un mapa de imports estáticos (ver nota abajo).
4. Renderiza: `<Composition.Home {...data} />` pasando los datos necesarios (productos, categorías, etc.).

Ejemplo conceptual (`app/[tenant]/page.tsx`):

```tsx
export default async function HomePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  const tenantId = await getTenantId(tenant)
  const template = await getTemplate(tenantId)
  const Composition = await TEMPLATES[template]()
  const data = await getHomeData(tenantId)
  return <Composition.Home {...data} />
}
```

> **Nota para implementación (Fase 7):** El patrón `import(\`@/templates/${template}/home\`)` con template literals **no funciona con Turbopack/Webpack** porque no pueden inferir los módulos estáticamente. La implementación real debe usar un mapa de imports estáticos:
> ```ts
> const TEMPLATES: Record<string, () => Promise<{ Home: ComponentType }>> = {
>   base: () => import('@/templates/base/home'),
>   moderna: () => import('@/templates/moderna/home'),
>   minimalista: () => import('@/templates/minimalista/home'),
>   clasica: () => import('@/templates/clasica/home'),
>   osca: () => import('@/templates/osca/home'),
>   natura: () => import('@/templates/natura/home'),
>   urbana: () => import('@/templates/urbana/home'),
> };
> // Uso: const Composition = await TEMPLATES[template]()
> ```
> Esto permite tree-shaking y type-safety.

- **Sin rebuild:** El dynamic import resuelve en runtime. Cambio de plantilla = próxima request usa la nueva composición.
- **Tree-shaking:** Next.js incluye solo las composiciones importadas dinámicamente en el bundle (si se configura `output: 'standalone'` + dynamic imports).
- **Fallback:** Si el dynamic import falla (plantilla borrada, typo), se hace fallback a `base`.
- **Tipado:** `lib/templates.ts` exporta un tipo `TemplateComposition = { home: ComponentType, product: ComponentType, ... }` para type-safety en el dynamic import.

### Validaciones

- API `PUT /api/config/settings` valida que `template` esté en la lista permitida por `plan_id` del tenant.
- **Resolución en runtime** (middleware / Server Component) vuelve a validar: si el tenant cambió de plan (bajó de tier), se fuerza fallback a `base` o a la primera plantilla permitida del nuevo tier.
- El `plan_id` se lee desde `subscriptions` (con `withTenantContext`), **no** desde `tenants`.

**Plantillas por tier (explícito):**

| Tier | Layout base (`base`) | Plantillas elegibles |
|------|---------------------|---------------------|
| Starter | ✅ (obligatorio) | 0 |
| Pro | ✅ | 3: `moderna`, `minimalista`, `clasica` |
| Business | ✅ | 6: `moderna`, `minimalista`, `clasica`, `osca`, `natura`, `urbana` |

> `base` **no cuenta** como una de las 3/6 plantillas del tier. Es el layout por defecto que todos los tiers tienen. Starter solo puede usar `base`. Pro y Business pueden elegir entre sus plantillas elegibles + `base`.

## Alternativas consideradas

1. **Tres frontends separados (Starter/Pro/Business deployados independientemente):** Descartada. Costo de mantenimiento 3x, deploys coordinados, drift inevitable entre versiones, no permite "cambiar cuando quiera".
2. **Inyección de código por tenant (HTML/CSS/JS propio):** Descartada (blueprint v2.6, opción B). Rompe el aislamiento RLS: un tenant inyecta JS malicioso que puede leer `localStorage` de otros tenants en el mismo origen, o hacer fetch a APIs internas. El soporte se vuelve inviable (debuggear código ajeno).
3. **Page builder visual (drag & drop, tipo Shopify):** Descartada para el lanzamiento (blueprint v2.6, opción A). 3-6 meses de desarrollo, requiere motor de layout, serialización de estado, preview, versionado. Reevaluar post-lanzamiento si el mercado lo demanda.
4. **Modo headless (API pública + frontend propio del tenant):** Descartada para MVP (opción C). Solo para clientes técnicos. No resuelve el 95% de tenants que quieren "tienda lista".

## Consecuencias

### Positivas
- **Componentes se mantienen una vez:** Fix en `ProductCard` aplica a las 6 plantillas instantáneamente.
- **Agregar plantilla nueva = crear 4-6 archivos de composición:** Sin tocar componentes compartidos. ~5-7 días por plantilla (según blueprint).
- **Cambio en caliente real:** El tenant elige plantilla en admin → próxima navegación ya la usa. Sin cache busting, sin rebuild.
- **Aislamiento preservado:** Nada de código inyectado por tenant. RLS intacto. Componentes auditables.
- **Testing centralizado:** Tests de `ProductCard` cubren todas las plantillas. Tests de composición solo verifican orden/props.

### Negativas
- **Disciplina de diseño requerida:** Todos los componentes deben ser compatibles con todas las composiciones (mismas props, mismos slots, responsive). Un cambio en `ProductCard` que rompa una composición afecta a todas.
- **CSS/estilos compartidos:** Requiere sistema de variables CSS por plantilla (colores, tipografía, spacing) que los componentes consuman via `var(--color-primary)`, etc. No hardcodear estilos en componentes.
- **Complejidad de testing visual:** 6 plantillas × 4 páginas × breakpoints = matriz de testing. Automatizar con Playwright + visual regression (futuro).
- **Bundle size:** Todas las composiciones se incluyen en el build (a menos que se use dynamic import por template). Acceptable para MVP (~6 plantillas × ~5KB c/u).

## Referencias

- Blueprint v2.6: `docs/superpowers/specs/2026-09-blueprint-v2.6.md` (Fase 7 — "Sistema de plantillas + 6 plantillas")
- Blueprint v2.6: sección "Componentes compartidos"
- Blueprint v2.6: sección "Frontend personalizable — Opciones evaluadas" (opción E elegida, A/B/C/D descartadas)
- Fase 4 (Personalización visual) define variables CSS que las plantillas consumen.
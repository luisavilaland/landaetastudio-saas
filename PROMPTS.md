# Prompts Reutilizables – saas-ecommerce

> Plantillas de prompts para agentes de IA. Copia y pega el que necesites en cada sesión.

---

## Tabla de Contenidos

| # | Sección | Uso principal |
|---|---------|--------------|
| 1 | [Calibración y análisis](#1-calibración-y-análisis) | Inicio de sesión, diagnóstico de estado |
| 2 | [Desarrollo](#2-desarrollo) | Features, bugs, templates por tipo |
| 3 | [Revisión y verificación](#3-revisión-y-verificación) | Post-tarea, auditoría |
| 4 | [Mantenimiento](#4-mantenimiento) | Limpieza, .gitignore |
| 5 | [Commits](#5-commits) | Commit y push |
| 6 | [Documentación](#6-documentación) | Actualizar docs |
| 7 | [Refactorización](#7-refactorización) | Refactors seguros |
| 8 | [Varios](#8-varios) | Salud, dependencias, revert |
| 9 | [Seed](#9-seed) | Actualizar datos de prueba |
| 10 | [Infra y Deploy](#10-infra-y-deploy) | Vercel, env vars, CI |

---

## 1. Calibración y Análisis

### Calibración Rápida (diaria)

```
Lee AGENTS.md, README.md, SETUP.md, PROMPTS.md y docs/arquitectura.md. Confirmame que entendés: stack, restricciones multi-tenant, DoD, herramientas de desarrollo, regla sobre comandos git y estructura del monorepo. Dame un visto bueno breve.
```

### Análisis Completo

```
Actuá como un desarrollador senior que se reincorpora al proyecto. Sin modificar archivos:

1. Lee AGENTS.md, README.md, SETUP.md, PROMPTS.md, docs/arquitectura.md y bitacora.md.
2. Ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`.
3. Explorá la estructura de apps/ y packages/ para detectar cambios.

Reportá:
- Estado de cada comando (lint, typecheck, build, test) — pasa/falla
- Roadmap actual del proyecto (qué fase o feature está en curso)
- Discrepancias entre documentación y código que encontraste
- Deuda técnica visible

Al final preguntame: "¿Qué modalidad de trabajo deseas hoy?"

1. Desarrollo interactivo — TDD + validación por paso
2. Code review — Revisión multi-dimensión del diff actual
3. Planificación semanal — Priorización táctica
4. Verificación post-tarea — DoD + smoke test
5. Commit y push — git status + mensaje Conventional Commits
```

---

## 2. Desarrollo

### Inicio de Feature

```
Vas a implementar la siguiente feature: [DESCRIPCIÓN].

Antes de escribir código:
1. Confirma que entiendes el alcance.
2. Indica qué archivos planeas crear o modificar.
3. Señala posibles riesgos o conflictos con la arquitectura existente.

Durante la implementación:
- Respeta AGENTS.md (tenantId en toda query, precios en centavos, validación Zod).
- Aplica la DoD al finalizar (pnpm lint, typecheck, build, test).
- Si incluye endpoints nuevos o lógica de negocio, añade tests.
- No ejecutes comandos git sin mi permiso explícito.

Al terminar:
- Resumen de lo hecho.
- Confirma que la DoD pasa.
- Indica si algún documento necesita actualizarse.
```

### Corrección de Bug

```
Hay un bug en [ARCHIVO/FUNCIONALIDAD]. Comportamiento esperado: [ESPERADO]. Comportamiento real: [REAL].

Antes de corregir:
1. Reproduce mentalmente el bug y explícame la causa raíz.
2. Propón una solución sin implementarla todavía.
3. Si es posible, escribe primero un test que falle.

Tras mi visto bueno, implementa y verifica que no introduces regresiones.
```

### Templates Base por Tipo de Tarea

#### API Route

```
Crea API Route en app/api/[ruta]/route.ts para [función].

- Método HTTP explícito (GET/POST/PUT/DELETE)
- Auth check con NextAuth si modifica datos
- Filtrar por tenantId en toda query
- Validación Zod de entrada
- Respuesta: NextResponse.json({ data?, error }, { status })
- Logger con @repo/logger
- Webhooks: verificar firma con MERCADOPAGO_WEBHOOK_SECRET
```

```
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@repo/db'
import { withTenantContext } from '@repo/db'
import { createLogger } from '@repo/logger'
import { schema } from './schema'

const logger = createLogger('ruta')

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message, field: parsed.error.issues[0].path[0] }, { status: 400 })
  }

  const ctx = withTenantContext(session.user.tenantId)
  const [result] = await db.with(ctx).insert(tabla).values(parsed.data).returning()

  logger.info({ tenantId: session.user.tenantId, id: result.id }, 'recurso creado')
  return NextResponse.json({ data: result }, { status: 201 })
}
```

#### Client Component

```
Crea componente en [ruta]/components/[nombre].tsx.

- 'use client' solo si necesita estado o efectos
- Props tipadas con interface
- TailwindCSS responsive
- Textos en español
- Estados: loading, empty, error, success
```

```
'use client'

interface ComponentProps {
  items: Item[]
  onSelect?: (item: Item) => void
}

export function ComponentName({ items, onSelect }: ComponentProps) {
  if (items.length === 0) {
    return <p className="text-muted-foreground">Sin resultados</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((item) => (
        <div key={item.id} onClick={() => onSelect?.(item)} className="..." />
      ))}
    </div>
  )
}
```

#### Server Component (RSC)

```
Crea página en app/[ruta]/page.tsx.

- async function, consulta datos directamente
- export const metadata para SEO
- NotFound si datos no existen
- Manejo de errores via error.tsx
```

```
import { db } from '@repo/db'
import { withTenantContext } from '@repo/db'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Component } from '@/components/component'

export const metadata = { title: 'Título', description: 'Descripción' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.tenantId) notFound()

  const ctx = withTenantContext(session.user.tenantId)
  const [data] = await db.with(ctx).select().from(tabla).where(eq(tabla.id, id)).limit(1)
  if (!data) notFound()

  return <Component item={data} />
}
```

#### Zod Schema

```
Crea schema en [ruta]/schemas.ts.

- Mensajes de error en español
- Validaciones específicas del dominio
- Re-exportar tipos inferidos
```

```
import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  price: z.number().int().positive('El precio debe ser un entero positivo (centavos)'),
  stock: z.number().int().min(0, 'El stock no puede ser negativo'),
})

export type ProductInput = z.infer<typeof productSchema>
```

---

## 3. Revisión y Verificación

### Verificación Post-Tarea

```
Revisa todos los cambios realizados en esta sesión:
- ¿Respetan AGENTS.md (tenantId, precios en centavos, validación Zod, imports)?
- ¿La lógica nueva tiene tests asociados?
- ¿Hay código duplicado, imports no usados, any o console.log?
- Si agregaste una env var nueva: ¿está en .env.local.example, turbo.json, y Vercel?

Ejecuta pnpm lint, pnpm typecheck, pnpm build y pnpm test. Si algo falla, corrígelo.

Sugiere si algún documento debería actualizarse.
```

### Auditoría de Tests

```
Audita la cobertura de tests actual. Para cada app y paquete:
- Cuántos tests hay.
- Qué funcionalidades críticas no tienen tests.
- Tests redundantes o inestables.

No modifiques nada, solo preséntame el informe.
```

---

## 4. Mantenimiento

### Limpieza de Archivos Sobrantes

```
Actúa como mantenedor del repositorio. Audita archivos sobrantes o redundantes. No borres nada, solo muéstrame una lista agrupada:

1. .gitignore duplicados fuera de la raíz.
2. Archivos de entorno duplicados (.env, .env.local, .env.example).
3. Boilerplate no usado (vercel.svg, next.svg, page.module.css no referenciados).
4. Artefactos no ignorados (.turbo/, coverage/, .next/ fuera de .gitignore).
5. README.md residuales en apps/ o packages/.
```

### Actualización de .gitignore

```
Revisa artefactos generados en esta sesión. Si alguno no está en .gitignore, añádelo.
```

---

## 5. Commits

### Commit y Push

```
Autorizo explícitamente comandos git.

Haz commit de todos los cambios realizados en esta sesión.

Antes del commit:
- git status. Resumen de cambios.
- Verifica que archivos no deseados estén en .gitignore.

Mensaje en formato Conventional Commits en español:
<tipo>: <resumen breve>

Cuerpo con viñetas de cambios principales.

Push a la rama actual.
```

### Commit y Push (rápido)

```
Autorizo comandos git. Haz commit con mensaje Conventional Commits en español y push.
```

---

## 6. Documentación

### Actualización de Documentación

```
Revisa los cambios realizados. Indica para cada archivo si necesita actualizarse:

- AGENTS.md: ¿nuevas restricciones, comandos o convenciones no documentadas?
- README.md: ¿cambió el roadmap, endpoints, setup o stack?
- SETUP.md: ¿cambió el setup, troubleshooting o datos de prueba?
- docs/arquitectura.md: ¿nuevas decisiones de diseño?
- .gitignore: ¿nuevos artefactos que ignorar?

Muéstrame la modificación propuesta. No la apliques sin confirmación.
```

---

## 7. Refactorización

### Refactor Seguro

```
Voy a pedirte un refactor. Antes de empezar:

1. Identifica el código y explícame el riesgo.
2. Confirma que hay tests que cubren esa funcionalidad. Si no, propón escribirlos primero.
3. Tras mi visto bueno, refactoriza en pasos pequeños.
4. Después de cada paso, ejecuta tests para verificar.
5. Al terminar, DoD completa.
```

---

## 8. Varios

### Verificar Salud del Proyecto

```
Chequeo rápido:
1. Ejecuta pnpm lint, pnpm typecheck, pnpm build, pnpm test.
2. Verifica que no hay dependencias obsoletas críticas.
3. Confirma que la estructura coincide con AGENTS.md.
4. Dame un parte breve.
```

### Actualizar Dependencias

```
Revisa dependencias (pnpm outdated) y muéstrame:
- Parches seguros (aplicables sin riesgo).
- Cambios mayores que podrían romper algo.
No actualices nada sin confirmación.
```

### Revertir Cambios

```
Quiero revertir todos los cambios de esta sesión al último commit. Muéstrame qué se descartaría antes de ejecutar.
```

---

## 9. Seed

### Actualización de Seed

```
Actualizá el seed de la base de datos para reflejar las funcionalidades hasta [FASE/DESCRIPCIÓN].

Reglas que aplican:
- Precios en centavos (integer).
- Fechas en UTC.
- Multi-tenant: todo dato de negocio con tenantId.
- Migraciones inmutables: no modifiques migraciones existentes.

Tareas:
1. Leer el seed actual (packages/db/seed.ts).
2. Identificar tablas nuevas y agregar datos de prueba.
3. Actualizar limpieza inicial (TRUNCATE) incluyendo nuevas tablas.
4. Insertar: tenants, usuarios, categorías, productos con variantes, imágenes, órdenes.
5. Verificar coherencia: precios en centavos, SKU basado en slug, totales correctos.
6. Ejecutar pnpm db:seed debe terminar sin errores.
7. DoD al finalizar.

No hagas commit sin autorización.
```

---

## 10. Infra y Deploy

### Configurar Vercel para una app nueva

```
Configurá el proyecto [storefront/admin/superadmin] en Vercel:

1. Root Directory: apps/[app]
2. Framework Preset: Next.js
3. Build Command: cd ../.. && pnpm run build --filter=[app]
4. Install Command: cd ../.. && pnpm install --frozen-lockfile

Agregá en Vercel todas las env vars listadas en turbo.json > tasks.build.env.
Si la app necesita vars opcionales (SENTRY_*, SUPERADMIN_HOST, ADMIN_HOST), agregalas también.
Cada app debe tener su propio vercel.json en apps/[app]/vercel.json.
```

### Agregar env var al proyecto

```
Agregué la variable [NOMBRE] al proyecto. Verificá antes del deploy:

1. ¿Está en .env.local.example con un placeholder descriptivo?
2. ¿Está en turbo.json > tasks.build.env (si es necesaria en build)?
3. ¿Está configurada en los proyectos de Vercel que la necesitan?
4. ¿Está validada en packages/validation/src/env.ts si es crítica?
5. Si reemplaza una variable anterior, ¿se eliminó la vieja de Vercel?
```

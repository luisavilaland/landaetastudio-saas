# Prompts Reutilizables – saas-ecommerce

> Plantillas de prompts para agentes de IA. Copia y pega el que necesites en cada sesión.

---

## Prompts y el toolkit

Cada prompt de este archivo asume que se usan las 7 herramientas del
proyecto. Ver `AGENTS.md` sección "Toolkit del proyecto" para el detalle
completo.

---

## Tabla de Contenidos

| #   | Sección                                                                        | Uso principal                           |
| --- | ------------------------------------------------------------------------------ | --------------------------------------- |
| 0   | [Prompts y el toolkit](#prompts-y-el-toolkit)                                  | Premisa común de las 7 herramientas     |
| 1   | [Calibración y análisis](#1-calibración-y-análisis)                            | Inicio de sesión, diagnóstico de estado |
| 2   | [Desarrollo](#2-desarrollo)                                                    | Features, bugs, templates por tipo      |
| 3   | [Revisión y verificación](#3-revisión-y-verificación)                          | Post-tarea, auditoría                   |
| 4   | [Mantenimiento](#4-mantenimiento)                                              | Limpieza, .gitignore                    |
| 5   | [Commits](#5-commits)                                                          | Commit, push, cierre de PR              |
| 6   | [Documentación](#6-documentación)                                              | Actualizar docs                         |
| 7   | [Refactorización](#7-refactorización)                                          | Refactors seguros                       |
| 8   | [Varios](#8-varios)                                                            | Salud, dependencias, revert             |
| 9   | [Seed](#9-seed)                                                                | Actualizar datos de prueba              |
| 10  | [Infra y Deploy](#10-infra-y-deploy)                                           | Vercel, env vars, CI                    |
| 11  | [Planificación y arquitectura](#11-planificación-y-arquitectura)               | ADRs, specs, plans, fases               |
| 12  | [Verificar docs vs código](#12-verificar-docs-vs-código)                       | Comparar contadores, versión, blueprint |
| 13  | [Auditoría por tarea](#13-auditoría-por-tarea)                                 | @QA + @Diseñador, anti-duplicación      |
| 14  | [Cerrar sesión y transferir contexto](#14-cerrar-sesión-y-transferir-contexto) | Resumen ejecutivo para nueva sesión     |
| 15  | [Crear migración nueva](#15-crear-migración-nueva)                             | Checklist obligatorio antes del commit  |

---

## 1. Calibración y Análisis

### Calibración Rápida (diaria)

```
Lee AGENTS.md, README.md, SETUP.md, PROMPTS.md, vault/05_Specs/arquitectura.md, blueprint v2.6 y specs de fase. Confirmame que entendés: stack, restricciones multi-tenant, DoD, herramientas de desarrollo, regla sobre comandos git, estructura del monorepo y workflow blueprint→ADR→spec→plan→fase. Dame un visto bueno breve.
```

### Análisis Completo

```
Actuá como un desarrollador senior que se reincorpora al proyecto. Sin modificar archivos:

1. Lee AGENTS.md, README.md, SETUP.md, PROMPTS.md, vault/05_Specs/arquitectura.md, vault/02_Bitacora/bitacora.md, blueprint v2.6 y specs de fase.
2. Ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`. Grabá las memorias relevantes en Engram y exportá al vault con `pnpm vault:export` antes de reportar.
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

### Verificación del Entorno

Antes de arrancar un PR en un worktree nuevo, verificar:

1. `git worktree list` — confirmar el worktree activo.
2. `git branch --show-current` — confirmar la branch.
3. `pnpm install` si falta `node_modules/`.
4. Copiar `.env.local` del main worktree (gitignored, nunca se commitea).
5. `opencode mcp list | grep engram` — confirmar "engram connected".
6. Verificar permisos de edición en el worktree (si bloquea escritura en `vault/`, reportar al humano).

Si algo falla, reportar antes de arrancar el trabajo.

### Orquestar subagentes con Paseo

Para un PR que requiere subagentes en paralelo:

1. Verificar worktree + workspace de Paseo para la branch del PR.
2. Reportar al humano el plan de despliegue:
   - Qué subagentes (con perfil Paseo).
   - Qué scope cada uno.
   - Qué archivos escribe cada uno (deben ser disjuntos).
3. Esperar OK humano antes de desplegar.
4. El humano despliega desde Paseo. El agente NO usa Task(...).
5. Cuando terminan: el Orquestador integra + bitácora + DoD + commit + PR.

Perfiles disponibles:

- Orquestador (Nemotron 3 Ultra Free).
- QA/Auditor (MiMo-V2.6-Flash Free).
- Programador (Big Pickle).
- Diseñador (Ling 3.0 Flash Fin Free).

### Gotcha: Big Pickle con prompts narrativos

Big Pickle se traba con prompts narrativos largos + rutas relativas. Observado 2 veces en el PR C (2026-09-26): emitía "I'll start by reading...", ejecutaba un `Test-Path` y terminaba sin editar nada.

Fix:

- Usar edits numeradas ("EDIT 1 — ...", "EDIT 2 — ...").
- Paths absolutos, no relativos.
- Si se traba: `paseo_get_agent_activity` para diagnosticar (el síntoma es `status: running` con `updatedAt` congelado).
- Archivar el subagente (`paseo_archive_agent`) y relanzar con el nuevo formato. Re-promptar repite el loop.

MiMo y Ling no tienen este problema.

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
- Grabá memorias en Engram PROACTIVAMENTE cuando:
  - Tomás una decisión arquitectónica que afecta a futuro.
  - Descubrís un patrón no obvio o un bug complejo.
  - Cambiás una regla del proyecto o establecés una convención nueva.
  NO grabar para tareas triviales (leer archivo, mover carpeta).

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

Grabá las memorias clave en Engram (decisiones, bugs, convenciones) y exportá al vault con `pnpm vault:export`.

Sugiere si algún documento debería actualizarse.
```

### Auditoría de Tests

```
Audita la cobertura de tests actual. La revisión adversarial dual (workflow `judgment-day`) llega en un PR posterior.

Para cada app y paquete:
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
Autorizo comandos git.

Hacé commit de los archivos que te indique explícitamente (staging
explícito, archivo por archivo, NUNCA `git add .` ni `git add -A`).

Antes del commit:
- `git status` — resumen de cambios.
- Verificar que los archivos staged sean exactamente los esperados.
- Verificar que archivos no deseados estén en `.gitignore`.
- NO ejecutar commit/push/merge/PR sin autorización explícita.

Mensaje en formato Conventional Commits en español:
<tipo>: <resumen breve>

Cuerpo con viñetas de cambios principales.

Push a la rama actual.

Si GGA bloquea el commit por timeout del provider (red/rate-limit):
usar `git commit --no-verify` y documentar el motivo en el body
del commit.

Si el PR corre en un worktree de Paseo: el Orquestador opera con
`workdir` apuntando al path del worktree. El main worktree queda
intacto.
```

### Commit y Push (rápido)

```
Autorizo comandos git. Haz commit con mensaje Conventional Commits en español y push.
```

### Cierre de PR completo

```
Cierre de PR completo

1. Verificar DoD: lint + typecheck + test + build.
2. Grabación proactiva de memorias en Engram (decisiones, patrones,
   bugs complejos, convenciones).
3. Bitácora actualizada (append-only, verificar con
   `git diff origin/develop -- vault/02_Bitacora/bitacora.md | grep "^-"`).
4. GGA pre-commit (automático, verificar que no bloqueó; si bloqueó
   por timeout → `--no-verify` documentado).
5. Export Engram al vault: pnpm vault:export.
6. Docs afectadas actualizadas.
7. Commit + push + PR.
8. Reportar al humano (NO esperar CI — el humano lo controla).
```

**Nota — verificaciones que no se automatizan.** Si una verificación automática falla pero el contenido parece correcto, **leer el diff manualmente** antes de asumir corrupción. Algunos cambios (formato, encoding) no se verifican con scripts triviales; el agente del PR E lo descubrió empíricamente con `prettier` sobre markdown. Evidencia: los snippets de código con indentación se reinterpretaban y los bloques `U+FFFD` de la bitácora no son validación de CI, son damage histórico. La automatización es una red de seguridad, no un oráculo.

### Localizar gh si no está en PATH

Si `gh` no está en PATH y no aparece en rutas estándar, buscar
en el directorio temporal del usuario actual.

PowerShell (método universal, sin hardcodear usuario):

```
Get-ChildItem -Path $env:LOCALAPPDATA\Temp\gh -Recurse -Filter gh.exe
```

Git Bash / WSL (equivalente):

```
find "$LOCALAPPDATA/Temp/gh" -name gh.exe 2>/dev/null
```

El path varía por usuario y versión de Windows. NO hardcodear
nombres de usuario en docs — usar variables de entorno
(`$env:LOCALAPPDATA`, `%LOCALAPPDATA%`, `$HOME`).

Si aparece el binario, agregar su directorio al PATH de la sesión
o invocarlo por path absoluto.

Para el cuerpo del PR, usar `--body-file` con un archivo temporal
(`$env:TEMP`), nunca `--body` inline: PowerShell manglea el quoting
de cuerpos largos. El MCP de GitHub no sirve (responde Bad credentials).

---

## 6. Documentación

### Actualización de Documentación

```
Revisa los cambios realizados. Indica para cada archivo si necesita actualizarse:

- AGENTS.md: ¿nuevas restricciones, comandos o convenciones no documentadas?
- README.md: ¿cambió el roadmap, endpoints, setup o stack?
- SETUP.md: ¿cambió el setup, troubleshooting o datos de prueba?
- vault/05_Specs/arquitectura.md: ¿nuevas decisiones de diseño?
- .gitignore: ¿nuevos artefactos que ignorar?
- blueprint v2.6 / specs de fase / ADRs: **¿este cambio invalida algún ADR, spec o el blueprint?**

Muéstrame la modificación propuesta. No la apliques sin confirmación.

Distinción docs/ vs vault/:
- `docs/`: docs operativos que herramientas leen programáticamente (migrations-archive/, superpowers/specs, superpowers/plans) y docs de workflow (WORKFLOW.md, README stub).
- `vault/`: docs narrativos para humanos (ADRs, bitácora, deuda, fases, specs narrativos).
- Si una doc es para el agente → docs/. Si es para humanos → vault/.
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

---

## 11. Planificación y Arquitectura

### Crear un ADR

```
Voy a proponer una decisión de arquitectura: [TÍTULO/TEMA].

Antes de escribir el ADR:
1. Confirmá que es una decisión arquitectónica real (difícil de revertir, impacto transversal).
2. Verificá si ya existe un ADR relacionado en vault/01_ADRs/.
3. Identificá: contexto, decisión, consecuencias, alternativas consideradas.

Formato (vault/01_ADRs/ADR-XXX-titulo.md):
- Título
- Fecha
- Contexto
- Decisión
- Estado (Propuesta/Aceptada/Rechazada/Suplantada)
- Consecuencias

No crear ADR para decisiones de producto (tiers, límites, emails) — eso va en spec/plan.
```

### Crear un spec de fase

```
Voy a escribir el spec técnico para la Fase [N]: [NOMBRE].

Estructura (docs/superpowers/specs/2026-09-faseN-nombre.md):
- Objetivo de la fase
- Dependencias (qué fases deben estar completas)
- Modelo de datos (tablas nuevas, cambios a existentes, RLS)
- API endpoints (nuevos + modificados, métodos, validaciones Zod)
- Flujo de datos (secuencia, webhooks, eventos)
- UI/UX (páginas, componentes, estados)
- Variables de entorno nuevas
- Tests requeridos (unitarios + E2E)
- Riesgos y mitigaciones
- Referencias: ADRs relacionados, blueprint sección X, spec transversal si aplica

Regla: Si el spec toca suscripciones, referenciar `subscription-lifecycle.md` en lugar de duplicar lógica.
```

### Crear el plan de una fase

```
Voy a escribir el plan de ejecución para la Fase [N]: [NOMBRE].

Creá el worktree de la fase con `paseo_create_workspace` y registrá el plan en Engram.

Estructura (docs/superpowers/plans/2026-09-faseN-nombre.md):
- Resumen de la fase (1-2 líneas)
- Tasks desglosadas (cada task: descripción, archivos a tocar, estimación)
- Dependencias entre tasks (orden, paralelizables)
- Criterios de aceptación por task
- Tests a crear (archivos, patrones)
- DoD específico de la fase
- Riesgos y mitigaciones
- Estimación total (días hábiles)

Referencias: spec de la fase, blueprint sección X, ADRs relacionados.
```

### Cerrar una fase

```
Fase [N] completada. Verificación de cierre:

1. **DoD técnico:**
   - [ ] pnpm lint, typecheck, build, test — todo verde
   - [ ] Tests nuevos pasando (unitarios + E2E si aplica)
   - [ ] Sin `any`, `console.log` fuera del logger, imports zigzagueantes

2. **Documentación actualizada en mismo PR:**
   - [ ] Spec de la fase (si cambió algo vs original)
   - [ ] Plan de la fase (marcar tasks completadas)
   - [ ] README.md (roadmap, endpoints, stack si cambió)
   - [ ] vault/05_Specs/arquitectura.md (ADRs nuevos/actualizados)
   - [ ] AGENTS.md (nuevas convenciones/restricciones)
   - [ ] SETUP.md (env vars, comandos, troubleshooting)
   - [ ] TESTING.md / TESTING-MANUAL.md (nuevos tests/áreas)
   - [ ] vault/02_Bitacora/bitacora.md (entrada con fecha, cambios, decisiones)

3. **Blueprint sync:**
   - [ ] Marcar fase como completada en blueprint v2.6
   - [ ] Verificar que no hay drift en fases siguientes

4. **Infra/Deploy:**
   - [ ] Variables de entorno en Vercel (prod + preview)
   - [ ] Migraciones aplicadas en Neon (prod)
   - [ ] Health checks OK en 3 apps
   - [ ] E2E pasando en CI (self-hosted)

5. **Memoria y docs:**
   - [ ] Export de Engram al vault: `pnpm vault:export`
   - [ ] Tabla de Contenidos de README.md actualizada (nuevas secciones/prompts)

6. **Git:**
   - [ ] Commit Conventional Commits en español
   - [ ] Push a develop
   - [ ] PR develop → main si es release (tag vX.Y.Z)

Solo cerrar fase cuando TODO esté ✅.
```

---

## 12. Verificar docs vs código

Comparar los siguientes contadores/valores entre docs y código real:

- Cantidad de tests (pnpm test) vs README, SETUP, TESTING, TESTING-MANUAL.
- Cantidad de archivos de test.
- Última versión / tag (git tag) vs README, bitácora.
- Estado de las fases del blueprint vs bitácora.

Reportar discrepancias sin modificar nada.

---

## 13. Auditoría por tarea

Después del PR de una tarea, desplegar 2 subagentes en paralelo desde Paseo (NO con Task(...) interno):

- QA/Auditor (perfil Paseo, MiMo-V2.6-Flash Free): correctitud, seguridad, calidad.
- Diseñador (perfil Paseo, Ling 3.0 Flash Fin Free): arquitectura, extensibilidad, coherencia.

Los despliega el humano desde Paseo. El Orquestador integra.

Aplicar regla anti-duplicación: verificar que los hallazgos no estén ya en vault/03_Deuda/deuda-tecnica.md antes de reportar.

Reporte breve. Publicar como comentario en el PR.
Severidad: CRÍTICO / ALTO / MEDIO / BAJO.
Bloqueantes (CRÍTICO/ALTO) → resolver antes de mergear.

---

## 14. Cerrar sesión y transferir contexto

La sesión está larga / el agente se traba / empieza a olvidar instrucciones. Generar un resumen ejecutivo para transferir a una nueva sesión:

- Tarea en curso (T?, rama, worktree path).
- Estado del worktree (git status, commits).
- Lo que falta (pendientes concretos).
- Próximos pasos (orden).
- Decisiones tomadas que la nueva sesión debe respetar.

Formato: prompt listo para pegar en la nueva sesión.

---

## 15. Crear migración nueva

Crear migración XX_nombre.sql en packages/db/migrations/.

Checklist obligatorio antes del commit:
[ ] Solo CREATE TABLE / ALTER TABLE / GRANT idempotente.
[ ] Sin DROP (excepto excepción documentada: DROP permitido solo con aprobación humana explícita + justificación en bitácora + PR de reset con README en docs/migrations-archive/).
[ ] Sin ALTER destructivo sobre tablas existentes.
[ ] No toca migraciones previas.
[ ] _journal.json con idx secuencial.
[ ] Snapshot coherente (si aplica).
[ ] Sin scratch files en staging (git status limpio).

CHECKPOINT: reportar el SQL completo y el checklist antes de commitear. La migración es inmutable una vez aplicada.

# Prompts Reutilizables – saas-ecommerce

> Plantillas de prompts para agentes de IA. Copia y pega el que necesites en cada sesión.

---

## Tabla de Contenidos

| # | Sección | Uso principal |
|---|---------|--------------|
| 1 | [🚀 Inicio de sesión](#1-inicio-de-sesión) | Calibración diaria, análisis de estado |
| 2 | [🛠️ Desarrollo](#2-desarrollo-de-features) | Implementar features, corregir bugs |
| 3 | [🔍 Revisión](#3-revisión-y-verificación) | Post-tarea, auditoría de tests |
| 4 | [🧹 Mantenimiento](#4-mantenimiento) | Limpieza, .gitignore |
| 5 | [📝 Commits](#5-commits) | Commit y push |
| 6 | [📚 Documentación](#6-documentación) | Actualizar docs |
| 7 | [🔄 Refactorización](#7-refactorización) | Refactors Seguros |
| 8 | [⚙️ Varios](#8-varios) | Salud, dependencias, revert |
| 9 | [📋 Cierre de Fase](#9-cierre-de-fase) | Realizar cierre formal de fase |
| 10 | [🌱 Actualización de Seed](#10-actualización-de-seed) | Actualizar seed con datos de prueba |

---

## 1. Inicio de Sesión

### 📋 Calibración Rápida (diaria)

```
Lee AGENTS.md y confírmame que entiendes las restricciones innegociables, la Definition of Done, las herramientas del proyecto y la regla sobre comandos git. Dame un visto bueno breve.
```

### 🔍 Análisis Completo (inicio de fase o después de mucho tiempo)

```
Vas a actuar como un desarrollador senior que se reincorpora al proyecto saas-ecommerce después de un tiempo fuera. Sigue estos pasos en orden, sin modificar ningún archivo:

1. Lee AGENTS.md, README.md, SETUP.md y docs/arquitectura.md.
2. Ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm test` para verificar el estado actual.
3. Explora la estructura de apps/ y packages/ para detectar cambios desde tu última visita.
4. Dame un resumen de:
   - Estado de los comandos obligatorios (¿pasan todos?).
   - Estado del roadmap (fases completadas y pendientes).
   - Cualquier discrepancia entre documentación y código real.
   - Sugerencias de deuda técnica visible.
```

---

## 2. Desarrollo de Features

### 🐱 Inicio de Feature

```
Vas a implementar la siguiente feature: [DESCRIPCIÓN BREVE].

Antes de escribir código:
1. Confirma que entiendes el alcance.
2. Indica qué archivos planeas crear o modificar.
3. Señala posibles riesgos o conflictos con la arquitectura existente.

Durante la implementación:
- Respeta todas las restricciones del AGENTS.md.
- Aplica la Definition of Done al finalizar (pnpm lint, typecheck, build, test).
- Si la feature incluye endpoints nuevos o lógica de negocio, añade los tests correspondientes.
- No ejecutes comandos git sin mi permiso explícito.

Al terminar:
- Muéstrame un resumen de lo hecho.
- Confirma que todos los comandos de la DoD pasan.
- Indica si algún documento necesita actualizarse según la sección de mantenimiento del AGENTS.md.
```

### 🐛 Corrección de Bug

```
Hay un bug en [ARCHIVO/FUNCIONALIDAD]. El comportamiento esperado es [ESPERADO], pero ocurre [REAL].

Antes de corregir:
1. Reproduce mentalmente el bug y explícame la causa raíz.
2. Propón una solución sin implementarla todavía.
3. Si es posible, escribe primero un test que falle reproduciendo el bug.

Tras mi visto bueno, implementa la solución y verifica que el test pasa y que no introduces regresiones.
```

---

## 3. Revisión y Verificación

### ✅ Verificación Post-Tarea

```
Revisa todos los cambios realizados en esta sesión. Para cada archivo modificado, indica:
- Si respeta las restricciones del AGENTS.md.
- Si la lógica nueva tiene tests asociados.
- Si hay código duplicado, imports no usados o comentarios innecesarios.

Ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm test`. Si algo falla, corrígelo antes de pedir confirmación.

Sugiere si algún documento (README.md, SETUP.md, AGENTS.md, docs/arquitectura.md, .gitignore) debería actualizarse.
```

### 📊 Auditoría de Tests

```
Audita la cobertura de tests actual. Para cada app y paquete, indícame:
- Cuántos tests hay.
- Qué funcionalidades críticas no tienen tests.
- Si hay tests redundantes o inestables.

No modifiques nada, solo preséntame el informe.
```

---

## 4. Mantenimiento

### 🧹 Limpieza de Archivos Sobrantes

```
Actúa como mantenedor del repositorio. Necesito que hagas una auditoría completa de archivos sobrantes o redundantes. No borres nada todavía, solo muéstrame una lista agrupada por categorías.

Realiza las siguientes búsquedas:

1. **Archivos .gitignore duplicados o innecesarios**
   - Busca todos los archivos `.gitignore` que no estén en la raíz del proyecto.
   - Si alguno contiene reglas que ya están en el `.gitignore` raíz, márcalos como redundantes.
   - Si alguno contiene reglas específicas que no están en el raíz, muéstramelas para decidir si migrarlas.

2. **Archivos de entorno duplicados**
   - Busca `.env.local`, `.env.example`, `.env.local.example`, `.env` fuera de la raíz.

3. **Boilerplate no usado**
   - Busca en `apps/` archivos como `vercel.svg`, `next.svg`, `favicon.ico`, `globals.css` vacíos, `page.module.css` no referenciados.

4. **Archivos temporales y artefactos**
   - Busca carpetas como `.turbo/`, `coverage/`, `test-results/`, `.next/`, `dist/` que estén fuera de `.gitignore`.
   - Verifica si el `.gitignore` raíz ya las ignora; si no, indícalo.

5. **Archivos de sistema**
   - Busca `.DS_Store`, `Thumbs.db`.

6. **READMEs sobrantes**
   - Confirma que no quedan `README.md` en `apps/` o `packages/` fuera del raíz.
   - Busca también `AGENTS.md` y `CLAUDE.md` residuales.

Al terminar, preséntame un resumen con las categorías y los archivos encontrados. Para cada uno, sugiere la acción. Después de tu informe, yo te daré la orden de eliminación si procede.
```

### 📝 Actualización de .gitignore

```
Revisa los artefactos generados en esta sesión (carpetas de build, cobertura, temporales). Si alguno no está en el .gitignore raíz, añádelo sin preguntar. Si tienes dudas sobre si algo debe ignorarse, consúltame.
```

---

## 5. Commits

### 📦 Commit y Push (genérico)

```
Autorizo explícitamente comandos git en esta tarea.

Vas a hacer commit de todos los cambios realizados en esta sesión.

Antes del commit:
- Revisa los archivos modificados, añadidos y eliminados con `git status`.
- Resume en una lista los cambios principales.
- Si hay archivos que no deban subirse, verifica que estén en .gitignore o sugiéreme excluirlos.

Después, redacta un mensaje de commit en formato conventional commits:

<tipo>: <resumen breve en español o inglés>

Incluye en el cuerpo del mensaje los cambios principales en viñetas.

Finalmente, haz push a la rama actual.
```

### ⚡ Commit y Push (ultra corto)

```
Autorizo comandos git. Haz commit de todos los cambios con un mensaje descriptivo en formato conventional commits y haz push a la rama actual.
```

---

## 6. Documentación

### 📖 Actualización de Documentación

```
Revisa los cambios realizados en esta sesión. Según la sección de mantenimiento del AGENTS.md, indica para cada archivo de documentación si necesita actualizarse:

- AGENTS.md: ¿hay nuevas restricciones, comandos o convenciones que no estén documentadas?
- README.md: ¿cambió el roadmap, endpoints, setup o stack?
- SETUP.md: ¿cambió el proceso de setup, troubleshooting o datos de prueba?
- docs/arquitectura.md: ¿se introdujo o modificó alguna decisión de diseño?
- .gitignore: ¿se generaron nuevos artefactos que deban ignorarse?

Para cada archivo que necesite cambios, muéstrame la modificación propuesta. No la apliques sin mi confirmación (salvo AGENTS.md si el cambio es evidente).
```

---

## 7. Refactorización

### 🔄 Refactor Seguro

```
Voy a pedirte un refactor. Antes de empezar:

1. Identifica el código a refactorizar y explícame el riesgo.
2. Confirma que hay tests que cubren esa funcionalidad. Si no los hay, propón escribirlos primero.
3. Tras mi visto bueno, realiza el refactor en pasos pequeños.
4. Después de cada paso, ejecuta los tests para verificar que nada se rompe.
5. Al terminar, ejecuta la DoD completa.
```

---

## 8. Varios

### 🏥 Verificar Salud del Proyecto

```
Haz un chequeo rápido de salud del proyecto:

1. Ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`.
2. Revisa que los tres servicios Docker estén levantados.
3. Verifica que no hay dependencias obsoletas críticas.
4. Confirma que la estructura de archivos coincide con el AGENTS.md.
5. Dame un parte breve: todo OK o qué falla.
```

### 📦 Actualizar Dependencias

```
Revisa las dependencias del proyecto (pnpm outdated) y muéstrame:
- Qué paquetes tienen actualizaciones disponibles.
- Cuáles son parches seguros (aplicables sin riesgo).
- Cuáles son cambios mayores que podrían romper algo.

No actualices nada sin mi confirmación.
```

### ↩️ Revertir Cambios

```
Quiero revertir todos los cambios hechos en esta sesión y volver al último commit. Muéstrame qué archivos se descartarían antes de ejecutar nada.
```

---

## 9. Cierre de Fase

### 📋 Cierre de Fase

```
Vas a realizar el cierre formal de la [FASE X] del proyecto saas-ecommerce.

Autorizo explícitamente comandos git en este cierre (commit, push, delete branch).

Paso 1 - Sincronización y limpieza de ramas
Cambia a main: git switch main

Asegúrate de que main está actualizada: git pull origin main

Elimina la rama local: git branch -d fase-[X]

Elimina la rama remota: git push origin --delete fase-[X]

Paso 2 - Actualización de documentación
Revisa y actualiza si es necesario:

README.md: marca la fase como completada (✅) en el roadmap. Verifica que no haya secciones duplicadas. Añade nuevos endpoints a las tablas correspondientes. Actualiza la fecha de "Última actualización".

SETUP.md: actualiza datos de prueba, nuevas variables de entorno, pasos de setup si cambiaron.

AGENTS.md: añade nuevas restricciones, comandos o convenciones descubiertas durante la fase. Corrige erratas visibles (caracteres extraños, errores de formato).

docs/arquitectura.md: documenta nuevas decisiones de diseño (nuevas tablas, elección de tecnologías, patrones usados).

.gitignore: verifica que nuevos artefactos estén ignorados.

Paso 3 - Crear o actualizar TESTING.md
Si no existe, créalo. Si existe, actualízalo.

Checklist de pruebas agrupado por fase con ✅ (verificado), ⬜ (pendiente).

Sección "Problemas Conocidos": tests que fallan, causa documentada, solución propuesta si se conoce, impacto (si bloquea o no).

Incluir pruebas manuales realizadas (flujo E2E, UX, etc.).

Paso 4 - Verificación DoD
Ejecuta y reporta el estado de cada comando:

pnpm lint

pnpm typecheck

pnpm build

pnpm test

Si algún comando falla, documéntalo en TESTING.md.

Paso 5 - Commit y push
Haz commits atómicos si los cambios son de distinta naturaleza:

feat: actualizar seed con datos de prueba Fase [X] (si aplica)

docs: cierre de fase [X] y actualización de documentación

fix: correcciones varias de la fase [X] (si aplica)

Haz push a main.

Paso 6 - Resumen final
Al terminar, preséntame un resumen con:

Estado de la DoD (✅/⚠️/❌ para cada comando)

Lista de archivos modificados

Rama eliminada (local y remota)

Problemas conocidos documentados
```

---

## 10. Actualización de Seed

### 🌱 Actualización de Seed

```
Actualizá el script de seed de la base de datos para reflejar todas las funcionalidades implementadas hasta la Fase [X].

Reglas del AGENTS.md que aplican:

Precios siempre en centavos (integer).

Fechas en UTC.

Multi-tenant: todos los datos de negocio deben tener tenantId.

Migraciones inmutables: no modifiques migraciones existentes.

Al finalizar, ejecutá pnpm lint, pnpm typecheck, pnpm build y pnpm test.

No ejecutes comandos git sin mi permiso.

Tareas
Leer el seed actual: localizá el archivo de seed (probablemente en packages/db/seed.ts) y entiende su estructura.

Identificar tablas nuevas: basándote en las features implementadas en cada fase, determiná qué tablas necesitan datos de prueba.

Actualizar la limpieza inicial: si el seed hace TRUNCATE, incluí las nuevas tablas respetando el orden de foreign keys.

Insertar datos de prueba para:

Tenant(s) de prueba

Usuarios (admin, cliente, superadmin)

Categorías con slugs únicos

Productos con variantes y SKUs coherentes

Imágenes vinculadas a productos (usar URLs placeholder)

Órdenes de ejemplo con estados variados y order_items

Cualquier otra entidad nueva de las fases completadas

Verificar coherencia:

Los precios están en centavos (enteros, sin decimales).

Las variantes tienen SKU basado en el slug del producto.

Las imágenes tienen tenantId y position correctos.

Las órdenes tienen totales que coinciden con la suma de sus items.

Ejecutar seed: pnpm db:seed debe terminar sin errores.

Si el seed falla, corregí los errores y volvé a ejecutar hasta que pase.

No hagas commit a menos que yo lo autorice explícitamente.
```
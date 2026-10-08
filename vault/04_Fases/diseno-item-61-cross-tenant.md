# Diseño: invariante de aislamiento cross-tenant (item 61)

**Estado:** propuesta para revision. **No implementado.**
**Origen:** item 61 de `vault/03_Deuda/deuda-tecnica.md`, hallazgo **H-T6-1** de la mini
auditoria T6 (PR #202). Documento de referencia: `vault/04_Fases/auditoria-t6-test-quality.md`.
**Fecha:** 2026-10-09.

> **Nota de trazabilidad:** el brief original de este trabajo daba el ref como `H-F2-1`. Es
> incorrecto: `H-F2-1` es el item 62 ("un nombre de funcion puede hacer el trabajo de la
> review"). El item 61 viene de **H-T6-1**. Corregido en rama, commit y PR.

---

## 1. Contexto: el problema y su demostracion

`withTenantContext` esta mockeado en los tests. El mock entrega filas fijas **sin importar que
`WHERE` lleve la query**. Por lo tanto, **la semantica del `WHERE` es invisible por
construccion** cuando `withTenantContext` esta mockeado: no hay ningun assertion que pueda
observarla.

### La demostracion

La mini auditoria T6 (`auditoria-t6-test-quality.md`, H-T6-1) aplico mutaciones reales al
codigo de `applyTransition` (`apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`)
y midio que la suite no se entera:

| Mutacion aplicada                                      | Resultado de la suite                |
| ------------------------------------------------------ | ------------------------------------ |
| `UPDATE` final sin `eq(dbSubscriptions.tenantId, ...)` | 53 passed — **no detectada**         |
| `SELECT` de la fila con filtro tautologico             | 53 passed — **no detectada**         |
| la resolucion de tenant devuelve un tenant fijo        | **detectada** (1 fallo cross-tenant) |

Las dos primeras son **fugas cross-tenant completas**: con el `SELECT` sin filtro, `row` pasa
a ser una fila arbitraria de otro tenant y el `UPDATE` por `row.id` escribe lo que sea. La
tercera, que no es una fuga, si se detecta.

### Por que esto importa mas de lo que parece

`subscriptions_tenant_idx` es **UNIQUE sobre `tenantId`** (`packages/db/src/schema.ts:91`):
hay exactamente **una** suscripcion por tenant. No es "una fila entre muchas" — es **la fila
del otro tenant, y solo esa**.

### Que verifican los tests cross-tenant actuales

`packages/db/src/__tests__/rls-cross-tenant.test.ts` usa **SQL real** contra Neon con
`DATABASE_APP_URL`, y verifica 8 casos: lectura, `INSERT`, `UPDATE` y `DELETE` cruzados, mas
el caso sin `set_tenant_id`. Es una red solida, pero **de otra capa**: protege la base de
datos, no el codigo que escribe mal la query. Un `WHERE` mal escrito no se rompe en
produccion — RLS lo detiene — y por eso el defecto puede convivir meses sinManifestarse.

### Lo que los tests mock-based sí verifican

Verifican que se **pase** el tenant correcto a `withTenantContext`. Eso es distinto de que
la query **filtre** por tenant, y la segunda es la que evita la fuga.

---

## 2. Alcance real del problema

- **31 call sites** de `withTenantContext` en produccion, en **24 archivos**:
  admin 11 archivos / 19 usos · storefront 9 / 12 · commerce 4 / 6.
- **12 tablas de negocio** con `tenantId: uuid('tenantId')`. `tenants` y `plans` son globales
  sin RLS por diseno.
- `tenantId` es un `string` plano. **No hay branding de tipos en ningun lado.**
- **No existe hoy ningun wrapper de tipos** para queries con scope de tenant.

---

## 3. Las cuatro opciones evaluadas

### Opcion A — Wrapper de query builder

**En prosa.** Una funcion recibe `tx` y `tenantId` y devuelve un builder de Drizzle ya
filtrado por tenant. No se puede obtener un builder sin pasar un tenant.

- **Como se usaria.** En un endpoint tipico, en vez de `tx.select().from(dbProducts).where(eq(dbProducts.tenantId, tenantId))`, se llama al wrapper y se encadena sobre el.
- **Que previene.** Olvidar el filtro en el `SELECT`.
- **Que NO previene.** El `UPDATE` sin filtro, que es la mitad del bug demostrado. Tampoco un `.where()` equivocado agregado despues sobre el builder.
- **Costo.** Alto: los 31 call sites.
- **Riesgo.** El builder de Drizzle es complejo; envolverlo genericamente pierde composicion de `.where()` y termina siendo un objeto con muchos metodos delegando.

### Opcion B — Branded type `TenantId`

**En prosa.** `TenantId` es un tipo marcado que solo se obtiene de un resolver. Las funciones
de query solo aceptan `TenantId`, nunca `string`.

**No detecta H-T6-1.** El bug es **borrar** `eq(tenantId, ...)`. Con un `TenantId`
correctamente branded, esa expresion se borra igual y el typecheck pasa. TypeScript no puede
marcar la presencia de una expresion dentro de un `.where()` compuesto: no tiene esa
capacidad.

Lo que si previene es **otro** bug: pasar un string arbitrario como tenant, o mezclar el
tenant de una sesion con el de otra. Eso es real y tiene valor, pero **no es este item**.

- **Costo.** Bajo. **Riesgo.** Bajo.

### Opcion C — `TenantFilteredRow<T>`

**En prosa.** La fila se envuelve en un tipo que **no expone `tenantId`** y que solo se
construye desde una query con scope. Como el tenant no esta en la fila, no hay forma de
escribir un `WHERE` usando el valor de la fila: hay que usar el que se paso al scope. Eso ata
por construccion el filtro del read al filtro del write.

- **Como se usaria.** El endpoint pide filas por el wrapper y recibe `TenantFilteredRow<T>[]`, que no expone `tenantId`.
- **Que previene.** Read y write desalineados: si el read no filtro, la fila es de otro tenant y el `WHERE` del write queda forzado al tenant del scope.
- **Que NO previene.** Un `WHERE` escrito a mano con el tenant equivocado; ni queries sin scope (joins, subconsultas) donde el wrapper no aplica.
- **Costo.** Medio-alto: un wrapper por tabla mas los 31 call sites.
- **Riesgo.** Que el wrapper tenga un escape (`as any`) y se vuelva decorativo.

### Opcion D — Funcion de dominio que posee read **y** write **(recomendada)**

**En prosa.** Una funcion en `@repo/db` hace el read y el write juntos y construye el `WHERE`
internamente. `applyTransition` deja de tocar Drizzle: pasa condiciones de dominio, no
columnas.

Es la opcion 3 de la propia auditoria T6, y es la unica que ataca el problema real.

---

## 4. Por que A, B y C no cierran el agujero

Este es el punto central del diseno, y la razon por la que el brief original (que musculaba
`TenantFilteredRow`) se queda corto:

> **El item 61 no es "falta un tipo". Es que con mocks, ninguna asercion puede observar el
> `WHERE`.** A, B y C mueven la responsabilidad a un lugar donde el typecheck la vigila — eso
> es real — pero **el test sigue sin poder verificar nada**. Los tres dejan abierto el
> agujero original: la mutacion del audit sigue pasando.

| Opcion                     | Detecta la mutacion H-T6-1 en el **typecheck** | El **test** puede verificar el `WHERE` | Costo      |
| -------------------------- | ---------------------------------------------- | -------------------------------------- | ---------- |
| A — query builder          | Parcial: solo el `SELECT`                      | ❌ No                                  | Alto       |
| B — branded `TenantId`     | ❌ No                                          | ❌ No                                  | Bajo       |
| C — `TenantFilteredRow<T>` | Si                                             | ❌ No                                  | Medio-alto |
| **D — funcion de dominio** | **Si**                                         | **Si, contra Neon**                    | **Medio**  |

La diferencia de la fila 3 es la que importa. Con D, la funcion se testea contra Neon con dos
tenants reales: ahi el `WHERE` **deja de ser invisible**, porque hay filas de verdad que
pueden o no aparecer.

---

## 5. Comparativa completa

| Criterio                           | A                | B                     | C                    | **D**               |
| ---------------------------------- | ---------------- | --------------------- | -------------------- | ------------------- |
| Detecta el `UPDATE` sin filtro     | ❌               | ❌                    | Parcial              | **Si**              |
| Detecta el `SELECT` sin filtro     | Si               | ❌                    | Si                   | **Si**              |
| El test puede observar el `WHERE`  | ❌               | ❌                    | ❌                   | **Si**              |
| Impide compilar sin tenant         | Si               | Parcial               | Si                   | **Si**              |
| Costo de migracion (31 call sites) | Alto             | Bajo                  | Medio-alto           | **Medio**           |
| Costo de mantenimiento             | Medio            | Bajo                  | Medio                | **Medio**           |
| Riesgo principal                   | Wrapper ilusable | No resuelve este item | Se vuelve decorativo | **Cajon de sastre** |

---

## 6. Recomendacion

**D primero. C como refuerzo futuro, si aparece un caso que D no cubra. B solo si aparece el
bug que previene. A descartada.**

El orden tiene una razon: D convierte el invariante en algo **verificable con SQL real**, que
es lo que H-T6-1 demuestra que falta. C y B son mejoras de robustez expresiva; pueden
sumarse despues, pero no reemplazan a D.

---

## 7. Plan de migracion

### Paso 1 — La funcion

`transitionSubscription(tenantId, from, to, patch)` en `@repo/db`.

Construye el `WHERE` internamente con `tenantId` + `from` como condiciones de concurrencia, y
expone solo condiciones de dominio. Quien la llama no puede omitir el filtro porque no tiene
como escribirlo.

### Paso 2 — Refactor de `applyTransition`

`apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` deja de construir el
`UPDATE`. El `UPDATE` del webhook deja de existir como codigo escrito a mano, y con el la fuga
que la auditoria demostro.

### Paso 3 — Test de integracion contra Neon

Dos tenants reales, se dispara el webhook y se verifica que **solo** se modifica la fila del
tenant correcto. **Este es el test que hoy no existe** y el que haria detectable la mutacion
del audit.

La migracion de los otros 30 call sites **no es parte de este PR**, ni del siguiente: es
trabajo incremental por tabla, priorizando las de mayor riesgo.

---

## 8. Que NO resuelve D

- **Queries Drizzle crudas escritas fuera de la funcion.** El tipo no impide que alguien
  escriba `tx.select().from(dbProducts)` en un endpoint nuevo. Solo lo desalienta.
- **El `SELECT` de lectura**, si se mantiene separado de la funcion. La funcion cubre el
  write; el read sigue necesitando su propio filtro.
- **Las tablas globales** (`tenants`, `plans`) no tienen `tenantId` y quedan fuera por
  diseno.
- **Una fuga en el codigo que resuelve el tenant**, antes de llegar a la query.

Es aceptable porque **RLS sigue siendo la ultima linea**: D no la reemplaza, agrega una capa
que ademas es testeable. El valor de D es que convierte un defecto silencioso en uno que
rompe un test.

---

## 9. Costos y riesgos

### El riesgo real: que la funcion se vuelva un cajon de sastre

Si `transitionSubscription` empieza a recibir flags booleanos (`skipStatusCheck`,
`alsoUpdatePlan`, `returnEverything`), el invariante se diluye: vuelve a ser codigo escrito a
mano, con una firma mas larga.

**Mitigacion en el diseno:** si la proxima transicion necesita una variante, **se agrega una
funcion nueva**, no un flag. El nombre de la funcion debe describir el caso, no el mecanismo.

### Costos

- **Este PR:** solo el diseño. Cero cambios de codigo.
- **Siguiente PR:** pasos 1 a 3. Bajo el para de **1 endpoint** (el webhook), que es donde esta
  la demostracion.
- **Resto:** migracion incremental de los otros 30 call sites, por tabla, starting por las de
  mayor exposicion.

### Lo que este diseno NO decide

Si la migracion completa de los 31 call sites vale la pena. Es una decision de costo total
que corresponde al humano, no a este documento. Lo que este documento sostiene es que
**migrar el endpoint del webhook si vale la pena**, porque es donde la auditoria demostro que
el defecto es explotable en el codigo.

---

## 10. Verificacion de que el invariante funciona

Test que el diseno debe producir:

1. **Mutacion del audit aplicada → test rojo.** Quitar el `tenantId` del `WHERE` de la funcion
   debe hacer fallar el test de integracion. Si no falla, el invariante no sirve y hay que
   volver al diseno.
2. **Dos tenants, un evento.** Solo la fila del tenant resuelto cambia.
3. **Concurrencia.** La condicion `from` en el `WHERE` descarta la transicion perdedora, que
   es el comportamiento actual y no debe perderse en el refactor.

El punto 1 es el que cierra el loop: hoy la mutacion pasa en verde. Con el, tiene que fallar.

---

## Ref

Item 61 · **H-T6-1** · `auditoria-t6-test-quality.md` · `rls-cross-tenant.test.ts` ·
`subscriptions_tenant_idx` (`schema.ts:91`) · `applyTransition`
(`webhooks/mercadopago/subscriptions/route.ts` L517 y L622)

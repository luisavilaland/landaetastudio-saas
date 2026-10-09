---
id: 259
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/una-capa-de-proteccion-enmascara-el-defecto
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 22:45:19"
updated_at: "2026-10-08 22:45:19"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Una capa de proteccion puede enmascarar un defecto y hacerlo indetectable"
---

# Una capa de proteccion puede enmascarar un defecto y hacerlo indetectable

**What**: Patron: una capa de proteccion puede ENMASCARAR un defecto y hacerlo indetectable. Un test que solo verifica en la capa superior no verifica nada, porque la capa de abajo hace el trabajo.

**Why**: Al implementar el item 61, la mutacion de la auditoria (quitar el filtro por tenantId del WHERE) dejo los tests **4/4 en verde**. No faltaba una asercion: RLS estaba deteniendo la escritura cross-tenant. El invariante existia en el codigo y era correcto, pero era **indistinguible del correcto**.

**Where**: `packages/commerce/src/__tests__/subscription-transition.test.ts` (dos capas). Contexto teorico: `packages/db/src/__tests__/rls-cross-tenant.test.ts` prueba RLS; la auditoria T6 lo senalo como "otra red".

**Learned**:
- **El sintoma de una capa que tapa a otra es un test que pasa en verde ante una mutacion que deberia romperlo.** Cuando se escribe un test de aislamiento sobre una tabla con RLS, hay que verificar *que el test falla con el filtro removido*. Si no falla, el test no esta probando el filtro: esta probando RLS.
- **La receta: una capa con la proteccion (comportamiento real) y una capa sin ella (aislamiento observable).** Con rol sin BYPASSRLS para lo que el usuario ve; con owner BYPASSRLS para lo que el invariante debe garantizar. Las dos hacen trabajos distintos y por eso fallan distinto: con la mutacion, la capa sin proteccion falla y la otra pasa.
- **Verificacion en rojo quirurgica:** cuando la mutacion debe fallar tests, el fallo tiene que ser atribuible. Si fallan todos por cascada (un test ensucia estado y el siguiente falla por eso), el diagnostico es mas ruidoso justo cuando mas falta claridad. Un `afterEach` que resetee **todos** los tenants, no solo el del test, hace la diferencia.
- **Cuidado con el cliente de la BD:** para *observar* una fila ajena hace falta un cliente sin RLS. Con el cliente de `app_user`, la lectura devuelve 0 filas y el test observa `undefined` — un fallo que parece del codigo y es del setup.
- **Corolario mas general:** RLS protege la DB, no el codigo que escribe mal la query. Un invariante de aplicacion verificado solo bajo RLS es un invariante **no verificado**: la capa de abajo lo salva siempre y el test nunca lo ejercita. Esto aplica a cualquier defensa en profundidad con un test que solo la ejercita en el nivel de arriba.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-pattern]]

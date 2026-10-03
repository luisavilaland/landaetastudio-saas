---
id: 107
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 02:35:22"
updated_at: "2026-10-03 02:35:22"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Caso B confirmado: ECONNREFUSED a Neon 54.209.204.248:5432 desde el runner"
---

# Caso B confirmado: ECONNREFUSED a Neon 54.209.204.248:5432 desde el runner

**What**: Test de conexion ejecutado en CI. **Caso B confirmado: `ERROR CONEXION: ECONNREFUSED connect ECONNREFUSED 54.209.204.248:5432`**. La conexion TCP al endpoint de Neon es rechazada desde el runner. Secret OK, driver OK, sintaxis OK, SSL solicitado.

**Why**: El item 41 llevaba 5 ciclos sin diagnostico. Este test entrega el codigo de error real que `drizzle-kit` se come.

**Where**: `.github/workflows/e2e.yml` job `seed`, step `Verificar conexion a Neon (con SSL)`. Commit `fd93d2d`, PR #181.

**Learned**:

1. **Resultado exacto:**
   ```
   2026-10-03T02:32:58.362  ##[endgroup]
   2026-10-03T02:32:58.675  ERROR CONEXION: ECONNREFUSED connect ECONNREFUSED 54.209.204.248:5432
   2026-10-03T02:32:58.688  ##[error]Process completed with exit code 1.
   ```
   **0.31 segundos** entre el fin del grupo env y el error. Falla en la apertura del socket TCP, antes de cualquier negociacion TLS o SQL.

2. **La IP `54.209.204.248` es el endpoint de Neon resuelto.** El host es `ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech` (**endpoint directo**, no `-pooler`).

3. **Esto explica por que `drizzle-kit` fallaba en 0.78s:** nunca llegaba a leer migraciones ni a evaluar el tracking. `Using 'postgres' driver...` se imprime antes de conectar; la conexion se rechaza al instante; hanji se come la excepcion.

4. **HIPOTESIS PRINCIPAL: IP del runner no esta en la lista IP Allow de Neon.** Localmente la conexion funciona, asi que **la IP de esta maquina si esta permitida**. El runner es `self-hosted` en Linux (`/home/runner/actions-runner`), o sea **otra maquina con otra IP publica**, que muy probablemente no esta en la allowlist. **Accion: verificar en Neon Console > Settings > Networking > IP Allow.**

5. **Descartado: el firewall local del runner.** El usuario verifico que la regla 10 acepta todo. Un firewall con DROP daria ETIMEDOUT, no ECONNREFUSED.

6. **Descartado: secret vacio / incorrecto.** `DATABASE_URL: ***` aparece en el log (mascara de GitHub) y el driver llega a intentar abrir el socket. Un 28P01 (password) o un ENOTFOUND (DNS) no se habrian dado.

7. **Nota sobre el orden de los checks:** `ECONNREFUSED` (RST en el TCP) es consistente con que Neon **cierre activamente** la conexion cuando la IP no esta permitida. No es el mismo comportamiento que "Neon rechaza sin TLS/SNI", que daria un cierre posterior. Por eso este test con `ssl: 'require'` **si es valido** para discriminar.

8. **HALLAZGO COLATERAL RELEVANTE (no del item 41):** `seed.ts` hace `TRUNCATE` de las 13 tablas, y CI corre `pnpm db:seed` contra la **MISMA base** que usa el desarrollo local (mismo host, confirmado en el paso anterior). En cuanto la conexion funcione, **cada run de CI va a borrar los datos de desarrollo**. Es possibly intencional para E2E, pero significa que dev y CI comparten estado y que un `db:seed` accidental desde local borra los datos de E2E y viceversa. **Vale la pena revisarlo antes de que el seed empiece a correr en CI.**

9. **El item 43 sigue vigente e independiente.** Aunque se solucione la allowlist, `drizzle-kit` seguira tragando los errores de migracion. Requiere wrapper propio o fix upstream (hanji sigue en `0.0.8`).

10. **Los errores de drizzle tampoco seLOOK visible aun.** Con la conexion rechazada, `db:migrate` falla antes de leer migraciones, asi que el item 43 no se ha ejercitado todavia en un escenario de error de SQL real.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]

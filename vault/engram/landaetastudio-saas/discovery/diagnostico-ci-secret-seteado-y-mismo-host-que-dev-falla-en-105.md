---
id: 105
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 00:15:56"
updated_at: "2026-10-03 00:15:56"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Diagnostico CI: secret seteado y mismo host que dev - falla en 0.78s (conexion)"
---

# Diagnostico CI: secret seteado y mismo host que dev - falla en 0.78s (conexion)

**What**: El step de diagnostico revelo la causa: **`DATABASE_URL` esta seteada y apunta al MISMO host que la DB de dev** (`ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech`). Se descartan las dos hipotesis principales: secret vacio y secret que apunta a otra base. Node v22.23.2, pnpm 9.0.0.

**Why**: El item 41 seguia sin error visible tras 4 ciclos. El step de diagnostico permitio descartas hipotesis sin depender del output de drizzle.

**Where**: `.github/workflows/e2e.yml` job `seed`, step `Diagnostico de DATABASE_URL`. PR #181, commit `22bc8c6`.

**Learned**:

1. **Output del step de diagnostico:**
   ```
   DATABASE_URL: set, host=ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech
   Node version: v22.23.2
   pnpm version: 9.0.0
   Working dir: /home/runner/actions-runner/_work/landaetastudio-saas/landaetastudio-saas
   ```

2. **HIPOTESIS DESCARTADA: secret vacio.** `DATABASE_URL` esta seteada. Ademas el log de GH muestra `DATABASE_URL: ***` (mascara de GitHub), lo que confirma que el secret existe.

3. **HIPOTESIS DESCARTADA: el secret apunta a otra base.** El host es **identico** al de `.env.local`. **CI y dev comparten la MISMA base de Neon.** Esto ademas mata la hipotesis previa de "tracking desalineado": si el hash coincide localmente (sha256 del baseline = fila unica del tracking), CI lee las mismas filas.

4. **Dato de timing decisivo:** `Using 'postgres' driver` 23:55:27.832 → exit 1 23:55:28.610 = **0.78 segundos**. Localmente el mismo comando (mismo DB, mismo hash) es un no-op exitoso. **Un fallo de 0.78s apunta a conexion o permisos, no a un error de SQL.** Ejecutar 13 `CREATE TABLE` contra Neon por red no cabe en 0.78s.

5. **Donde ocurre el fallo:** `Using 'postgres' driver...` se imprime ANTES de conectar. La conexion ocurre dentro de la task de hanji, y ahi cualquier excepcion se traga. Por eso 0.78s es compatible con: host/IP no permitido por Neon, connection limit, o credencial rechazada **desde el runner**.

6. **El runner es `self-hosted`** (`runs-on: self-hosted`), no GitHub-hosted. Si la IP del runner no esta en la allowlist de Neon, la conexion se rechaza al instante. **Localmente la IP si esta permitida** (por eso el no-op funciona). Esta es ahora la hipotesis principal.

7. **PRUEBA SIGUIENTE PROPUESTA (no autorizada todavia):** agregar antes de `db:migrate` una comprobacion de conectividad directa con el cliente `postgres`, que SSi imprime errores:
   ```bash
   node -e "const p=require('postgres');const s=p(process.env.DATABASE_URL,{connect_timeout:10000});s\`SELECT 1\`.then(r=>{console.log('conexion OK');return s.end()}).catch(e=>{console.log('ERROR CONEXION:',e.code,e.message);process.exit(1)})"
   ```
   Distingue en un ciclo: Conexion rechazada (red/allowlist) vs. conexion OK + fallo posterior de drizzle.

8. **El item 43 sigue siendo valido e independiente:** aunque se descubra la causa, `drizzle-kit` seguira tragando los errores de migracion en CI. Eso hay que resolverlo igual (wrapper propio o fix upstream).

9. **El step de diagnostico resulto seguro en produccion:** imprimio solo el host, sin usuario ni password. La doble barrera funciono tal como se diseño.

10. **Estado del PR #181:** `build` verde (17m45s), `seed` rojo, `e2e` skipeado, `e2e-success` rojo. NO mergeado. Items 40, 42 y 43 registrados.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]

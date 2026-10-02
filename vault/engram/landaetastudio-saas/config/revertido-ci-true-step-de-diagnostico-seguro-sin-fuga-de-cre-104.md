---
id: 104
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 23:53:15"
updated_at: "2026-10-02 23:53:15"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Revertido CI:true + step de diagnostico seguro (sin fuga de credenciales) + item 43"
---

# Revertido CI:true + step de diagnostico seguro (sin fuga de credenciales) + item 43

**What**: Revertido `CI: true` (commit `7de34a4`, inerte) y agregado un step de diagnostico seguro en el job `seed` de `e2e.yml`. Registrado el item 43 (bug de `drizzle-kit`/`hanji` que traga los errores de migracion). Todo en el PR #181, no mergeado.

**Why**: `CI: true` no funciono (drizzle-kit nunca lee `process.env.CI`). El error del item 41 sigue oculto, asi que se cambio de estrategia: en vez de pelear con el spinner, medir el entorno.

**Where**:
- `.github/workflows/e2e.yml` job `seed`: revertido `CI: true`, nuevo step `Diagnostico de DATABASE_URL`
- `vault/03_Deuda/deuda-tecnica.md` - item 43 en L1071
- Branch `chore/deuda-items-40-42`, PR #181

**Learned**:

1. **FUGA DE CREDENCIALES EVITADA - el snippet propuesto con `sed` era peligroso.** Este patron:
   ```bash
   host=$(echo "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#')
   echo "DATABASE_URL: set, host=$host"
   ```
   **si la URL no matchea el patron, `sed` devuelve la LINEA ENTERA sin modificar**, y se imprime el usuario y el password en el log de CI. Es exactamente el fallo que se buscaba evitar.

2. **El primer reemplazo tambien tenia una fuga.** Con `${DATABASE_URL#*@}` + validacion `^[A-Za-z0-9._-]+$`, un valor sin `@` ni `/` (por ejemplo una password suelta `SUPERSECRETPASSWORD`) pasaba el regex y se imprimia como "host". Detectado al correr 9 casos de prueba adversarios.

3. **Guardia final adoptado (probado, 0 fugas en 9 casos):**
   ```bash
   case "$DATABASE_URL" in
     *"://"*@*)
       host="${DATABASE_URL#*@}"; host="${host%%/*}"
       if printf '%s' "$host" | grep -Eq '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
         echo "DATABASE_URL: set, host=$host"
       else
         echo "DATABASE_URL: set (host con formato inesperado, omitido)"
       fi ;;
     *) echo "DATABASE_URL: set (sin formato URL reconocible, omitido)" ;;
   esac
   ```
   Doble barrera: exige esquema `://` **y** `@`, y exige que el host tenga punto y TLD. Un password nunca pasa las dos.

4. **Caso verificado que sí imprime:** `postgresql://neondb_owner:SUPERSECRET@ep-dawn-hat-abc.us-east-1.aws.neon.tech/neondb` -> `host=ep-dawn-hat-abc.us-east-1.aws.neon.tech`. Solo el host, nunca las credenciales.

5. **El step tambien imprime** `node --version`, `pnpm --version` y `pwd`, para descartar divergencia de version con el local (node 22 en CI, el local puede diferir).

6. **Item 43 registrado (ALTA / MEDIA-ALTA).** Documenta el `process.exit(1)` sincrono, la vista sin rama de error, los cuatro intentos fallidos (`CI: true`, `--verbose`, stderr, shim de exit), la reproduccion local determinista y las tres mitigaciones. Nota relevante: **hanji sigue en `0.0.8`**, asi que actualizar drizzle-kit a `0.31.11` puede no alcanzar.

7. **Verificacion del workflow:** `js-yaml` (vía `node_modules/.pnpm/js-yaml@4.1.1/`) parsea el archivo y confirma 6 steps en `seed`, con el diagnostico antes de `db:migrate`, y **`CI` ausente del env del step de migracion** (revertido correctamente).

8. **El diagnostico sigue sin correr.** El PR #181 esta abierto esperando CI. Lo que se sabra: si `NEON_DATABASE_URL` esta vacia, y el host contra el que se conecta (para compararlo con `ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech` del `.env.local`).

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]

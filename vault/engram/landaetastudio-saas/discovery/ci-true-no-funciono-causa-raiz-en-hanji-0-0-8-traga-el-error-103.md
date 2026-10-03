---
id: 103
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 23:42:57"
updated_at: "2026-10-02 23:42:57"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "CI:true no funciono - causa raiz en hanji 0.0.8 traga el error, seed falla en 1s"
---

# CI:true no funciono - causa raiz en hanji 0.0.8 traga el error, seed falla en 1s

**What**: `CI: true` **NO funciono** - el error de `drizzle-kit migrate` sigue invisible en CI. Reproduje el fallo localmente y encontre la causa raiz en el codigo de `hanji@0.0.8` (embebido en `drizzle-kit@0.31.10`): `renderWithTask` traga la excepcion y llama `process.exit(1)` de forma sincrona antes de que el terminal renderice. Un shim que difiera el exit tampoco sirve, porque la vista nunca imprime el texto del error.

**Why**: El paso 1 del fix del item 41 era hacer visible el error antes de diagnosticarlo. No se logro por la via elegida.

**Where**: `.github/workflows/e2e.yml` job `seed`, `node_modules/drizzle-kit/bin.cjs`, `node_modules/hanji` (via pnpm `hanji@0.0.8`).

**Learned**:

1. **`CI: true` es un no-op para drizzle-kit.** `process.env.CI` aparece **0 veces** en `bin.cjs`. El commit `7de34a4` es inerte. Ademas el comentario que lo acompaña **queda incorrecto** (dice que el error queda legible cuando se demostro que no).

2. **`--verbose` NO es una opcion valida** de `drizzle-kit migrate` en 0.31.10: `Unrecognized options for command 'migrate': --verbose`.

3. **stderr esta VACIO.** Todo el output (incluido el error) va a stdout, y a stdout no llega. `2>&1 1>$null` no devuelve nada.

4. **Causa raiz en `hanji@0.0.8`:**
   ```js
   function renderWithTask(view, task) {
     const terminal = new TaskTerminal(view, process.stdout);
     terminal.requestLayout();
     try { const result = yield task; terminal.clear(); return result; }
     catch (err) { terminal.reject(err); process.exit(1); }   // ← exit sincrono
   }
   ```
   Y en `MigrateProgress.render()`:
   ```js
   if (status === "pending" || status === "rejected") { return `[${spin}] applying migrations...`; }
   return `[✓] migrations applied successfully!`;
   ```
   **El estado `rejected` renderiza el MISMO spinner que `pending`.** El texto del error nunca se imprime por este camino, con o sin TTY. No es un problema de TTY: es que la vista no tiene rama para el error.

5. **Reproduccion local (determinista, sin push):**
   ```powershell
   $env:DATABASE_URL = "postgresql://u:p@host.invalid.tld:5432/db"
   cd packages/db; pnpm exec drizzle-kit migrate 2>&1
   ```
   Resultado: spinner + `exit 1` + **cero mensaje**. Idéntico a CI. **Esto permite iterar sin consumir un ciclo de CI de 20 min.**

6. **Un shim que difiera `process.exit` NO alcanza.** Se probo:
   ```js
   const origExit = process.exit.bind(process);
   process.exit = (c) => { process.exitCode = c ?? 0; setTimeout(() => origExit(process.exitCode), 150); };
   ```
   Resultado: el error sigue sin imprimirse. Confirma que el problema es que la vista no renderiza el error, no la carrera de exit.

7. **`drizzle-kit` va en 0.31.10; la ultima es 0.31.11.** Pero **`hanji` sigue en 0.0.8** (su ultima version). El bug vive en hanji, asi que actualizar drizzle podria no bastar. Probar el upgrade es barato (una llamada) pero no garantizado.

8. **Dato clave del log de CI: `seed` falla en ~1 segundo** (`Using 'postgres' driver` 23:38:58 → exit 1 23:38:59). Demasiado rapido para ejecutar 13 `CREATE TABLE` contra Neon por red. Eso apunta a **fallo temprano**: conexion, autenticacion, o **secret vacio**, no a un error de SQL.

9. **PRUEBA DIAGNOSTICA PROPUESTA (mas directa que pelear con hanji):** agregar al job `seed` un step que imprima si `DATABASE_URL` esta seteada y su host (el host no es secreto):
   ```yaml
   - run: |
       if [ -z "$DATABASE_URL" ]; then echo "DATABASE_URL: VACIA"; else
         echo "DATABASE_URL: set, host=$(echo "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#')"; fi
   ```
   En **un ciclo** distingue las dos hipotesis principales: secret ausente/vacio (falla en <1s, coherente) vs. error de SQL real.

10. **Honestidad sobre el estado:** el error real del item 41 **sigue sin obtenerse**. Lo que se logro fue reproducir el mecanismo de ocultamiento y descartar `CI: true` como solucion. El commit `7de34a4` deberia revertirse o corregirse su comentario porque afirma algo falso.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]

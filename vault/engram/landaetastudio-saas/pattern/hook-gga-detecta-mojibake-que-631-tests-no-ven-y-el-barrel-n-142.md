---
id: 142
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/gga-detecta-doble-encoding-que-los-tests-no
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 15:27:09"
updated_at: "2026-10-04 15:27:09"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Hook GGA detecta mojibake que 631 tests no ven; y el barrel no debe exportar redisClient"
---

# Hook GGA detecta mojibake que 631 tests no ven; y el barrel no debe exportar redisClient

**What**: El hook GGA (pre-commit) rechazo el commit de `chore/fix-48-49-50` con dos hallazgos: (1) mojibake en `apps/admin/app/api/subscriptions/preapproval/route.ts` (`â†'` por `→`, `Â§` por `§`), introducido en T4; (2) el barrel de `@repo/commerce` reexportaba `redisClient`. Ambos corregidos. El hook tambien detecta la doble codificacion de forma fiable, cosa que el scan propio no hacia.

**Why**: El DoD completo (631 tests, lint, typecheck, build, format:check) estaba **verde** con el mojibake presente. Ningun test, linter ni typechecker ve un character incorrecto dentro de un comentario.

**Where**: `apps/admin/app/api/subscriptions/preapproval/route.ts`, `packages/commerce/src/index.ts`

**Learned**:
- **GGA es el unico control que detecta doble encoding.** ESLint, tsc, vitest y prettier son todos ciegos a esto porque el archivo sigue siendo UTF-8 valido. No usar `--no-verify` salvo timeout de red: el hook Find Real Bugs.
- **El patron de deteccion de doble encoding por codepoint es correcto pero hay que aplicarlo al archivo MODIFICADO, no solo al nuevo.** L39 y L152 venian de T4, en develop, intactos desde hace horas.
- **Al修复 con `[System.IO.File]::WriteAllLines` se introduce CRLF en un repo LF.** Hay que normalizar con `ReadAllText` + `-replace "\r\n", "\n"` + `WriteAllText` con UTF8 sin BOM. Git lo avisaba como warning en `git add`; si no se mira, se commitea.
- **El hallazgo de GGA sobre `redisClient` era preexistente pero valido:** AGENTS.md prohibe usar `redisClient.*` directo, y exportarlo desde el barrel invita a violarlo. Nada lo importaba, asi que removerlo fue de 1 linea y alineo el codigo con la regla. Vale la pena arreglar hallazgos preexistentes cuando son de 1 linea, seguro y el hook bloquea el commit.
- **Al:`~no-verify` nunca es la respuesta por defecto cuando el hook da contenido sustantivo.** Solo por timeout/red, y documentandolo en el body del commit (AGENTS.md).

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-pattern]]

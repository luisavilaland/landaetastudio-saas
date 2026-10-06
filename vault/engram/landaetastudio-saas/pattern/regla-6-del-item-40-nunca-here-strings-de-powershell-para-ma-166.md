---
id: 166
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 14:11:17"
updated_at: "2026-10-06 14:11:17"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Regla 6 del item 40: nunca here-strings de PowerShell para markdown con backticks"
---

# Regla 6 del item 40: nunca here-strings de PowerShell para markdown con backticks

**What**: El item 40 paso de 5 a 6 reglas. La nueva: **nunca here-strings de PowerShell para markdown con backticks**. Registrada con el sintoma exacto, la causa y un escaneo por codepoint.

**Why**: Tercera aparicion del mismo patron en una sola sesion. La causa es heramental, no de disciplina, asi que la regla tiene queReads "no uses esa herramienta" y no "tene mas cuidado".

**Where**: `vault/03_Deuda/deuda-tecnica.md`, seccion `## Reglas` del item 40, nueva regla 6

## El mecanismo

En PowerShell, dentro de strings dobles y here-strings, **el backtick es el caracter de escape**. Entre los escapes validos esta **el tabulador vertical (U+000B)**. Entonces una linea escrita para producir un path entre backticks genera:

```
`vault/engram/`  ->  U+000B + "ault/engram/"
```

**Sintoma diagnostico:** el archivo muestra `ault/engram/` e `itacora.md`. Pasa `format:check`. Pasa UTF-8 estricto. **Solo se detecta enumerando codepoints**, porque el defecto es un control char y el scan de CJK no lo cubre.

Afecta por igual a `@"..."@` y a `$var = "..."`. Aplica a todo markdown con inline code, code fences o paths entre backticks.

**Mitigacion:** usar la herramienta de edicion para escribir markdown; PowerShell solo para leer, escanear o escribir texto plano ASCII sin backticks. Si es inevitable, escapar el backtick duplicandolo o construirlo con `[char]96`.

## Las tres apariciones

| # | Donde | Que paso |
|---|-------|----------|
| 1 | Item 40 (2026-10-02) | `Add-Content` con here-strings rompio encoding |
| 2 | Item 52 (2026-10-04) | 2 reemplazos bulk metieron U+0007 y U+000B que **reemplazaron letras**: `approved` -> `<BEL>pproved`. 682 tests en verde |
| 3 | Body del PR #197 (2026-10-05) | 5 control chars (2x U+000B, U+0008, 2x U+000D). Detectado porque el grep mostraba `ault/` sin la `v` |

## Learned

- **Un control char inyectado es invisible para las herramientas que no los buscan.** `prettier --check` lo acepta, UTF-8 estricto lo acepta, `git diff` lo muestra. Solo un escaneo por codepoint lo caza. El scan de CJK es insuficiente: son categorias disjuntas.
- **El sintoma visible es la mejor alarma.** `ault/` sin la `v` fue lo que delato el defecto. Un archivo con un caracter menos de lo esperado es senal de escape mal interpretado, no de typo.
- **La tercera vez ya no es discipline: es herramienta.** Las dos primerasFix se buscaron en la intencion ("ser mas cuidadoso"). La regla correcta es cambiar de herramienta.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]

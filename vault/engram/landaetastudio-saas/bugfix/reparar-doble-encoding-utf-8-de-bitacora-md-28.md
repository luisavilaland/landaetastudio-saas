---
id: 28
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/bitacora-double-encoding
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 13:08:34"
updated_at: "2026-09-26 13:08:34"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Reparar doble-encoding UTF-8 de bitacora.md"
---

# Reparar doble-encoding UTF-8 de bitacora.md

**What**: `bitacora.md` estaba doble-codificado (UTF-8→CP1252→UTF-8) desde antes de la migración. Reparado con algoritmo selectivo; 594 de 1521 líneaas corregidas, 0 diferencias ASCII.
**Why**: El humano ve mojibake en Obsidian (`Ã¡` en vez de `á`, `â€"` en vez de `—`).
**Where**: `vault/02_Bitacora/bitacora.md` (working tree, SIN commitear). Backup en `%TEMP%\opencode\bitacora-backup.md`.
**Learned**:
- **La receta `iconv -f UTF-8 -t CP1252 | iconv -f CP1252 -t UTF-8` FALLA en este archivo.** Lanza excepción en el índice 126374: `No se puede convertir el carácter Unicode U+2192`. Motivo: el archivo es **híbrido** — hay 6 chars ya correctos (5× `→` U+2192 línea ~1330, 1× `✅` U+2705 línea ~1346) conviviendo con el resto doble-codificado. Un blanket iconv los destruiría.
- Algoritmo usado (greedy longest-match, seguro): en cada char con byte CP1252 >= 0x80, intentar construir una secuencia UTF-8 válida (2/3/4 bytes según lead byte); si el decode estricto tiene éxito, colapsar; si no, emitir el char tal cual. **Propiedad de seguridad clave: nunca puede consumir un char ASCII**, porque una continuación UTF-8 siempre cae en 0x80-0xBF y los bytes CP1252 de ASCII son 0x00-0x7F. Por eso 0 líneas difieren en ASCII.
- El prefijo de 140770 bytes es **byte-idéntico a `develop:bitacora.md`**: la corrupción es 100% anterior a la migración. El bloque appendeado por la migración (1072 bytes) estaba limpio.
- Resultados: C3 83 (Ã) 897→0, C3 A2 (â) 477→1, `â€` 191→0, em-dash E2 80 94 12→191, `ó` C3 B3 60→517, 4 control bytes preservados, 1520 líneas, appended block byte-idéntico. Tamaño 141842→137644 bytes.
- **Residual sin reparar**: línea ~1289 `### 2026-09-21 â¬ <0x1D>  T7:` — secuencia mojibake *incompleta*: los bytes originales eran E2 AC y el 3er byte fue sustituido por un control char 0x1D (uno de los 4 preexistentes). Irreparable automáticamente; las otras cabeceras usan `—` como separador, así que probablemente sea `—`, pero requiere decisión humana.
- Gotchas de PowerShell en esta máquina: `CP` es alias de `Copy-Item` (no usar como nombre de función); `"line ~$var:"` rompe el parser (usar `${var}`); un .ps1 con no-ASCII debe escribirse en UTF-8 **sin BOM** y ejecutarse con `-File` desde `powershell.exe` (PS 5.1 lo lee como ANSI si tiene BOM); la consola no renderiza UTF-8 (el `?`/`�` en output es de la terminal, no del archivo).
- Para verificar encoding hay que comparar bytes, no texto de consola: `README.md`, `AGENTS.md`, `docs/README.md` y `vault/README.md` están limpios (0 mojibake); la bitácora era el único archivo corrupto.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-bugfix]]

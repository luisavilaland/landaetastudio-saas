---
id: 116
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 13:50:46"
updated_at: "2026-10-03 13:50:46"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Para deshacer mojibake usar mapeo explicito, nunca el roundtrip de iconv"
---

# Para deshacer mojibake usar mapeo explicito, nunca el roundtrip de iconv

**What**: Para deshacer doble-encoding (mojibake), usar **reemplazo dirigido con mapeo explicito y auditable**. NO usar el pipeline `iconv -f UTF-8 -t CP1252 | iconv -f CP1252 -t UTF-8`, que es identidad.

**Why**: Se Estaba a punto de aplicar ese pipeline a archivos `.env*` con acentos espanoles legitimos. Habria corrompido archivos sanos y no habria arreglado los rotos.

**Where**: Aplicado en `.env.local` con 4 reglas de mapeo. Patron generalizable a cualquier archivo del repo.

**Learned**:

1. **Por que `iconv -f UTF-8 -t CP1252 | iconv -f CP1252 -t UTF-8` es identidad:** el primer `iconv` interpreta los bytes como UTF-8 (decodifica correctamente el mojibake a caracteres reales) y emite CP1252. El segundo lee esos bytes como CP1252 y emite UTF-8. La cadena se deshace y se rehace. **Cero cambios.**

2. **Ademas es peligroso sobre texto sano:** `a` (U+00E1) en UTF-8 son bytes C3 A1. El primer `iconv` los decodifica como `a` y emite A1. El segundo lee A1 como CP1252 y produce otro caracter. **Acentos legitimos se corrompen.**

3. **El metodo correcto: mapeo explicito.** Se listan los codepoints origen y destino, se cuentan las ocurrencias, y se aplica `String.Replace`. Es auditable: se sabe exactamente que se cambio y cuantas veces.

   ```powershell
   $map = @{ ([char]0x00E2 + [char]0x201D + [char]0x20AC) = ([char]0x2014); ... }
   foreach ($k in $map.Keys) {
     $n = ([regex]::Matches($c, [regex]::Escape($k))).Count
     $c = $c.Replace($k, $map[$k])
   }
   ```

4. **Verificar SIEMPRE el resultado del fix.** En este caso el em-dash aparecia manglado en **dos ordenes distintos** (`U+00E2 U+201D U+20AC` y `U+00E2 U+20AC U+201D`). El mapeo inicial cubria uno solo y dejo un residuo que **ningun chequeo de mojibake detects** (el chequeo decia 0 y el archivo ya estaba casi limpio). Solo la relectura del archivo mostro el resto.

5. **Regla de diagnostico:** "tiene caracteres no-ASCII" **no es** "esta corrupto". Acentos espanoles, guiones de caja, bullets y emoji son UTF-8 valido. Verificar archivo por archivo antes de reportar.

6. **Verificar que los valores no cambian.** Tras el fix, comparar las lineas `KEY=VALUE` contra el backup con `-cne` (case-sensitive). 21 variables, 0 diferencias. Si el fix toca valores, es un bug.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]

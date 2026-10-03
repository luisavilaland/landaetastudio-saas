---
id: 114
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 12:51:41"
updated_at: "2026-10-03 12:51:41"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Escaneo de CJK sobre salida de git es estructuralmente incapaz de detectarlo"
---

# Escaneo de CJK sobre salida de git es estructuralmente incapaz de detectarlo

**What**: El CJK que Luis detecto en la bitacora (PR #181) NO fue un fallo del regex de escaneo: fue que **el escaneo se hizo sobre la salida de `git`, que llega a PowerShell ya destructiva**. Los ideogramas se convierten en signos de pregunta `?` ANTES de tocar el regex. Mi chequeo reportaba "0 CJK" con el CJK presente en el archivo.

**Why**: Luis aprobo el PR #181 con el comentario de que habia CJK colado. Investigar por que mi verificacion no lo detecto resulto mas valioso que la correccion misma.

**Learned**:

1. **El regex `[\u4e00-\u9fff]` en PowerShell es correcto.** Verificado contra el string real: `Merece留下来 porque...` matchea. El problema nunca fue el patron.

2. **La salida de un comando nativo en PowerShell se decodifica con la codificacion de consola (CP437/CP1252).** Los ideogramas CJK no existen en esa codificacion, asi que llegan como `?`. Lo mismo ocurre con U+FFFD. **Cualquier chequeo de encoding hecho sobre `git diff | Where-Object {...}` es estructuralmente incapaz de detectar lo que dice detectar.**

3. **Sintoma diagnostico que lo delata:** `git show HEAD:<archivo>` imprime `?` donde deberia ir el CJK, pero `Get-Content -Encoding UTF8` del archivo si lo muestra. Si el conteo via git da 0 y el archivo tiene CJK, **el escaneo esta mal, no el archivo**.

4. **El metodo fiable es escanear el archivo, nunca la salida de git:**
   ```powershell
   $l = Get-Content <archivo> -Encoding UTF8
   for ($i=0; $i -lt $l.Count; $i++) {
     if ($l[$i] -match '[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]') { "CJK L$($i+1)" }
     if ($l[$i] -match "\uFFFD")                              { "MOJIBAKE L$($i+1)" }
   }
   ```
   El item 40 de la deuda **ya indicaba este metodo**. Me desvie de mi propia regla.

5. **El item 40 se actualizo** con la causa raiz y el sintoma diagnostico. No se creo un item nuevo: el patron ya estaba cubierto, lo que faltaba era que **la regla警惕ara sobre el error de implementacion**.

6. **Ironia que hubo que corregir:** al explicar el problema en el item 40, **escribi los ideogramas CJK literales como ejemplo**. Eso reintrodujo el defecto que el escaneo debe detectar, y el propio item quedo con 1 CJK. Se reemplazo por una descripcion en palabras, con nota de no citar CJK literal al explicar este problema.

7. **Los 2 CJK que quedan en `bitacora.md` (L976-977) son intencionales.** Vienen del commit `77ea187` "fix(bitacora): reparar encoding mojibake preexistente": documentan un artefacto CJK que se encontro en `SECURITY.md`. **No tocarlos.** `git blame` es la forma de distinguir "mio" de "documentado a proposito".

8. **Tambien hay 14 U+FFFD preexistentes en la bitacora** (L855, 861, 864, 936-945, 1560) y 1 en la deuda (L501). Documentados en los items 25 y 26. No son mios.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]

---
id: 115
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 13:48:41"
updated_at: "2026-10-03 13:48:41"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Correccion: solo .env.local tenia mojibake, los .example estaban limpios"
---

# Correccion: solo .env.local tenia mojibake, los .example estaban limpios

**What**: Correccion del diagnostico de encoding de `.env*`. El diagnostico inicial reporto mojibake en los 3 archivos; la verificacion archivo por archivo mostro que **solo `.env.local` lo tenia**. Los 2 `.example` (trackeados) estaban limpios.

**Why**: Un diagnostico de encoding basado en "tiene caracteres no-ASCII" produce falsos positivos. Los acentos espanoles legitimos (`n`, `a`, `o`), el guion de caja y el emoji de aviso son UTF-8 valido, no corrupcion.

**Where**:
- `.env.local` (gitignored, reparado localmente)
- `.env.example`, `.env.local.example` (trackeados, sin cambios)
- `vault/02_Bitacora/bitacora.md` - entrada 2026-10-03

**Learned**:

1. **Resultado real del inventario:**

| Archivo | BOM | Mojibake | Trackeado |
|---|---|---|---|
| `.env.local` | Si | Si (10 lineas) | No |
| `.env.example` | No | **No** | Si |
| `.env.local.example` | No | **No** | Si |

2. **Los `.example` NO tenian nada que arreglar.** Sus lineas no-ASCII son `n`, `a`, `o`, guion de caja `─` y `⚠️`. Contarlos como "mojibake" por tener caracteres no-ASCII es un error de criterio.

3. **`.env.local` reparado con mapeo explicito:** `U+00E2 U+201D U+20AC` -> `U+2014` (60), `U+00C3 U+00BA` -> `U+00FA` (uacute), `U+00C3 U+00B3` -> `U+00F3` (oacute), `U+00C3 U+00AD` -> `U+00ED` (iacute). **21 variables byte-identicas al backup**, verificado linea por linea con `-cne`. BOM removido.

4. **El em-dash estaba manglado en DOS ordenes distintos** dentro del mismo archivo: `U+00E2 U+201D U+20AC` en los separadores y `U+00E2 U+20AC U+201D` en un comentario. El mapeo inicial cubria solo el primero y dejo un residuo. **Lo detecto verificar el resultado del fix, no el chequeo de mojibake** (que ya daba 0).

5. **Asimetria que convino investigar:** el archivo que nadie ve (`.env.local`, gitignored) tenia el problema; los que se distribuyen (`.example`, trackeados) estaban bien. La conclusion inicial era la inversa de la realidad.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]

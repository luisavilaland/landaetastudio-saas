#!/usr/bin/env node
// Check de encoding por codepoints.
//
// Item 75: `.gga` excluye `*test.ts`, asi que los tests quedan fuera de la unica
// red que detecta doble encoding. Un archivo con mojibake sigue siendo UTF-8
// VALIDO, asi que ESLint, tsc, vitest y prettier no ven nada. Este check cierra
// ese gap.
//
// REGLA DE ORO: este archivo NO contiene los caracteres corruptos. Los patrones se
// describen por codepoint (`String.fromCharCode`) porque escribir el mojibake
// como ejemplo en el detector lo reintroduce en el repo -- que es el bug que
// este script existe para encontrar.
//
// Uso: node scripts/check-encoding.mjs [directorio]
// Exit 0 sin hallazgos nuevos. Exit 1 con hallazgos nuevos.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.argv[2] || process.cwd()

// --- Codepoints de los patrones ---------------------------------------------

const CP_REPLACEMENT = 0xfffd // byte que no es UTF-8 valido, guardado como U+FFFD
const CP_BOM = 0xfeff // BOM UTF-8, solo invalido al inicio del archivo
const CP_LEAD_2BYTE = 0x00c3 // primer byte de una secuencia UTF-8 de 2 bytes
const CP_LEAD_3BYTE = 0x00e2 // primer byte de una secuencia UTF-8 de 3 bytes
const CP_MIDDLE_3BYTE = 0x20ac // segundo byte de la secuencia de 3 bytes
const LATIN1_LOW = 0x0080
const LATIN1_HIGH = 0x00bf

/**
 * Tercer codepoint de una secuencia de 3 bytes, valido.
 *
 * NO es un rango Latin-1. Cuando una secuencia UTF-8 de 3 bytes se decodifica
 * como cp1252, sus 3 bytes caen en 0x80..0x9F, y cp1252 mapea ese rango a
 * puntuacion tipografica (guiones U+2013/U+2014, comillas U+201C/U+201D) y a
 * algunos signos como U+0152, U+017D o U+02C6. Esos NO caen en U+0080..U+00BF:
 * un detector que solo mira el rango Latin-1 no ve las rayas ni las comillas
 * tipograficas rotas, que es justo el caso mas comun.
 */
const CP1252_HIGH_MAPPINGS = new Set([
  0x0192, 0x02c6, 0x02dc, 0x0152, 0x0153, 0x0160, 0x0161, 0x017d, 0x017e, 0x0178,
  0x201a, 0x201e, 0x2020, 0x2021, 0x2030, 0x2018, 0x2019, 0x201c, 0x201d,
  0x2022, 0x2013, 0x2014, 0x2122, 0x2039, 0x203a,
])

// --- Alcance ----------------------------------------------------------------

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.git',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
])

// `vault/engram` es tool-managed: lo regenera `pnpm vault:export`. Las
// observaciones pueden traer texto de terceros y no son codigo del proyecto.
//
// `packages/db/migrations/` NO se excluye a proposito: las migraciones son
// inmutables por regla del proyecto y si una tuviera mojibake, hay que saberlo.
const EXCLUDE_PATHS = [/(^|[\\/])vault[\\/]engram([\\/]|$)/]

const EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
  '.json',
  '.sql',
  '.yml',
  '.yaml',
  '.sh',
])

// --- Corrupcion preexistente, documentada ----------------------------------
//
// Lista vacia desde el 2026-10-09: los dos archivos que estaban aqui
// (`bitacora.md` y `deuda-tecnica.md`, items 76 y 77) se repararon con
// reemplazo dirigido byte a byte. El unico mojibake que queda en `bitacora.md`
// es INTENTIONAL: es el ejemplo documentado de como se ve un archivo roto, asi
// que no lo cuenta el detector y no debe "arreglarse".
//
// Cuando se agregue un archivo aqui, la entrada necesita:
//   - por que NO se puede reparar todavia,
//   - el PR que lo va a reparar,
//   - si el hallazgo es recuperable de git o hay que reconstruir por inferencia.
const KNOWN_CORRUPT = new Set([])

// --- Deteccion --------------------------------------------------------------

/**
 * Cuenta hallazgos en un texto.
 *
 * Se itera por code point (no por indice de UTF-16) para no partir pares
 * surrogate en un emoji o un caracter fuera del BMP.
 */
export function scanText(text) {
  const found = {
    replacement: 0,
    bom: false,
    moji2: 0,
    moji3: 0,
    control: 0,
  }

  if (text.length > 0 && text.charCodeAt(0) === CP_BOM) found.bom = true

  const chars = [...text]

  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0)
    const next = i + 1 < chars.length ? chars[i + 1].codePointAt(0) : -1
    const next2 = i + 2 < chars.length ? chars[i + 2].codePointAt(0) : -1

    if (cp === CP_REPLACEMENT) {
      found.replacement++
      continue
    }

    // Doble encoding de 2 bytes: U+00C3 seguido de un byte de continuacion
    // Latin-1. Ejemplo: una "n" con tilde (U+00F1) leida como cp1252 produce
    // U+00C3 U+00B1.
    if (cp === CP_LEAD_2BYTE && next >= LATIN1_LOW && next <= LATIN1_HIGH) {
      found.moji2++
      continue
    }

    // Doble encoding de 3 bytes: U+00E2 U+20AC seguido de un mapeo de cp1252
    // (raya, comilla tipografica, signo). Ejemplo: una raya (U+2014) leida como
    // cp1252 produce U+00E2 U+20AC U+201D.
    if (
      cp === CP_LEAD_3BYTE &&
      next === CP_MIDDLE_3BYTE &&
      CP1252_HIGH_MAPPINGS.has(next2)
    ) {
      found.moji3++
      continue
    }

    // Control chars que no son tab, LF ni CR.
    if (
      (cp >= 0x00 && cp <= 0x08) ||
      cp === 0x0b ||
      cp === 0x0c ||
      (cp >= 0x0e && cp <= 0x1f)
    ) {
      found.control++
    }
  }

  return found
}

export function countIssues(scan) {
  return scan.replacement + (scan.bom ? 1 : 0) + scan.moji2 + scan.moji3 + scan.control
}

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_PATHS.some((re) => re.test(full))) continue
      yield* walk(full)
    } else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
      yield full
    }
  }
}

export function scanRepo(root) {
  const results = []
  for (const file of walk(root)) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const scan = scanText(text)
    const total = countIssues(scan)
    if (total === 0) continue
    results.push({ file: relative(root, file).replace(/\\/g, '/'), ...scan, total })
  }
  results.sort((a, b) => b.total - a.total)
  return results
}

// --- Reporte ----------------------------------------------------------------

const DESCRIPTION = {
  replacement: 'U+FFFD (byte no UTF-8)',
  bom: 'U+FEFF al inicio (BOM)',
  moji2: 'doble encoding 2 bytes (U+00C3 + Latin-1)',
  moji3: 'doble encoding 3 bytes (U+00E2 U+20AC + Latin-1)',
  control: 'control char fuera de tab/LF/CR',
}

function describe(scan) {
  const parts = []
  if (scan.replacement) parts.push(`${scan.replacement}x ${DESCRIPTION.replacement}`)
  if (scan.bom) parts.push(`1x ${DESCRIPTION.bom}`)
  if (scan.moji2) parts.push(`${scan.moji2}x ${DESCRIPTION.moji2}`)
  if (scan.moji3) parts.push(`${scan.moji3}x ${DESCRIPTION.moji3}`)
  if (scan.control) parts.push(`${scan.control}x ${DESCRIPTION.control}`)
  return parts.join(', ')
}

export function formatReport(results, knownCorrupt = KNOWN_CORRUPT) {
  const known = results.filter((r) => knownCorrupt.has(r.file))
  const fresh = results.filter((r) => !knownCorrupt.has(r.file))
  const lines = []

  if (known.length > 0) {
    lines.push('Corrupcion preexistente (KNOWN_CORRUPT, no bloquea el merge):')
    for (const r of known) lines.push(`  ${r.file} -> ${describe(r)}`)
    lines.push('')
  }

  if (fresh.length > 0) {
    lines.push('HALLAZGOS NUEVOS:')
    for (const r of fresh) lines.push(`  ${r.file} -> ${describe(r)}`)
    lines.push('')
    lines.push('Como revisarlos:')
    lines.push('  Los codepoints se ven sin mostrarlos, para no copiar el valor corrupto:')
    lines.push('    node -e "const s=require(\'fs\').readFileSync(\'<archivo>\',\'utf8\');')
    lines.push('      [...s].forEach((c,i)=>{const p=c.codePointAt(0);')
    lines.push('      if(p>127)console.log(i, c, \'U+\'+p.toString(16).toUpperCase())})"')
    lines.push('')
    lines.push('Causa mas probable (item 40, regla 6): en PowerShell, un')
    lines.push('`Get-Content` SIN `-Encoding UTF8` decodifica UTF-8 como ANSI, y el')
    lines.push('`Set-Content -Encoding UTF8` siguiente escribe el resultado deformado')
    lines.push('mas un BOM. Usar la herramienta de edicion, no PowerShell, para .ts.')
  }

  return { lines, freshCount: fresh.length, knownCount: known.length }
}

// Solo imprime y setea exit code cuando se ejecuta directamente, no cuando se
// importa (los tests lo importan).
if (process.argv[1] && process.argv[1].endsWith('check-encoding.mjs')) {
  const results = scanRepo(ROOT)
  const { lines, freshCount, knownCount } = formatReport(results)

  if (lines.length > 0) {
    console.log(lines.join('\n'))
    console.log('')
  }

  console.log(
    `Encoding: ${knownCount} archivo(s) en KNOWN_CORRUPT, ${freshCount} con hallazgos nuevos.`,
  )

  if (freshCount > 0) {
    console.log('')
    console.log('Ref: item 75 en vault/03_Deuda/deuda-tecnica.md.')
    process.exit(1)
  }
  process.exit(0)
}
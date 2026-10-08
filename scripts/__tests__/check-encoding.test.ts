import { describe, it, expect } from 'vitest'
import { scanText, countIssues, formatReport } from '../check-encoding.mjs'

/**
 * Test del detector de encoding (item 75).
 *
 * REGLA: los textos corruptos se CONSTRUYEN por codepoint con
 * `String.fromCharCode`. Escribirlos literales los meteria en el repo, que es
 * exactamente el bug que el detector existe para encontrar.
 */

/** Texto con "n" tilde (U+00F1) doblemente decodificado: U+00C3 U+00B1. */
const MOJI_2BYTE = String.fromCharCode(0x00c3, 0x00b1)

/** Texto con raya (U+2014) doblemente decodificado: U+00E2 U+20AC U+201D. */
const MOJI_3BYTE = String.fromCharCode(0x00e2, 0x20ac, 0x201d)

/** Byte UTF-8 invalido, que Node guarda como U+FFFD al decodificar. */
const REPLACEMENT = String.fromCharCode(0xfffd)

/** BEL (U+0007): control char fuera de tab/LF/CR. */
const CONTROL = String.fromCharCode(0x0007)

/** BOM UTF-8. */
const BOM = String.fromCharCode(0xfeff)

describe('check-encoding: deteccion', () => {
  it('texto UTF-8 normal no produce hallazgos', () => {
    // Incluye acentos, em-dash y section sign: todos correctos.
    const clean = 'Titulo\n- " due"o: seccion 6.3, precio UYU 2.000\n'

    expect(countIssues(scanText(clean))).toBe(0)
  })

  it('acentos en portugues y espanol no son falsos positivos', () => {
    // "Sao", "nao", "ano" con tilde: son codepoints UNICOS, no el par
    // U+00C3 + Latin-1 que produce el doble encoding. Es el caso que mas
    // riesgo tiene de falsos positivos.
    const clean = 'Sao Paulo, nao, ano, coração, ação, seção'

    expect(countIssues(scanText(clean))).toBe(0)
  })

  it('detecta doble encoding de 2 bytes', () => {
    const scan = scanText(`correo: due${MOJI_2BYTE}o@tenant.com`)

    expect(scan.moji2).toBe(1)
    expect(countIssues(scan)).toBe(1)
  })

  it('detecta doble encoding de 3 bytes', () => {
    const scan = scanText(`nada ${MOJI_3BYTE} importante`)

    expect(scan.moji3).toBe(1)
    expect(countIssues(scan)).toBe(1)
  })

  it('detecta U+FFFD', () => {
    expect(scanText(`texto ${REPLACEMENT} roto`).replacement).toBe(1)
  })

  it('detecta BOM solo al inicio', () => {
    expect(scanText(`${BOM}contenido`).bom).toBe(true)
    // Un U+FEFF a mitad de archivo (zero-width no-break space) no es BOM.
    expect(scanText(`linea1${BOM}linea2`).bom).toBe(false)
  })

  it('detecta control chars fuera de tab, LF y CR', () => {
    expect(scanText(`antes${CONTROL}despues`).control).toBe(1)
    // Tab, LF y CR son legitimos.
    expect(countIssues(scanText('a\tb\nc\r\nd'))).toBe(0)
  })

  it('cuenta varios hallazgos en el mismo texto', () => {
    const scan = scanText(
      `${BOM}a${MOJI_2BYTE}b${MOJI_3BYTE}c${REPLACEMENT}d${CONTROL}`,
    )

    // BOM + moji2 + moji3 + U+FFFD + control = 5.
    expect(scan).toEqual({
      replacement: 1,
      bom: true,
      moji2: 1,
      moji3: 1,
      control: 1,
    })
    expect(countIssues(scan)).toBe(5)
  })
})

describe('check-encoding: reporte', () => {
  // Fixture de archivo corrupto. El path es inventado a proposito: el set real
  // de KNOWN_CORRUPT esta VACIO desde el 2026-10-09 (items 76 y 77 reparados),
  // asi que un test que dependa de un path real solo verifica el estado de
  // produccion, no el comportamiento del reporte. Se inyecta el set.
  const CORRUPT_FILE = 'vault/02_Bitacora/bitacora.md'
  const KNOWN = new Set([CORRUPT_FILE])

  const corruptResult = {
    file: CORRUPT_FILE,
    replacement: 34,
    bom: true,
    moji2: 1,
    moji3: 0,
    control: 3,
    total: 39,
  }

  it('los archivos en KNOWN_CORRUPT se reportan pero no bloquean', () => {
    const { lines, freshCount, knownCount } = formatReport(
      [corruptResult],
      KNOWN,
    )

    expect(knownCount).toBe(1)
    expect(freshCount).toBe(0)
    expect(lines.join('\n')).toContain('KNOWN_CORRUPT')
  })

  it('con el set de produccion vacio, un archivo con hallazgos es NUEVO', () => {
    // Este test es el que detecto que items 76 y 77 quedaban fuera de la lista
    // Known al repararlos: sinKNOWN_CORRUPT, cualquier hallazgo bloquea.
    const { freshCount, knownCount } = formatReport([corruptResult])

    expect(knownCount).toBe(0)
    expect(freshCount).toBe(1)
  })

  it('un hallazgo nuevo se cuenta aparte de los conocidos', () => {
    const { freshCount, knownCount } = formatReport([
      corruptResult,
      {
        file: 'apps/admin/app/api/x/__tests__/route.test.ts',
        replacement: 0,
        bom: false,
        moji2: 1,
        moji3: 0,
        control: 0,
        total: 1,
      },
    ], KNOWN)

    expect(knownCount).toBe(1)
    expect(freshCount).toBe(1)
  })

  it('sin hallazgos no imprime nada', () => {
    const { lines } = formatReport([])

    expect(lines).toEqual([])
  })
})
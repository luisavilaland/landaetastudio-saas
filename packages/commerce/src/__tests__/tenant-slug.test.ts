import { describe, expect, it } from 'vitest'
import {
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  isReservedSlug,
  slugRejectionMessage,
  validateSlug,
} from '../tenant-slug'

/**
 * Tests puros de `validateSlug` (S3 / T8 / D8). Sin base: la funcion no toca la
 * DB, asi que un test que necesitara una seria probando otra cosa.
 *
 * La seccion de D8 es la que importa: cada uno de los 16 reservados se prueba
 * por separado en vez de recorrer el Set. Un `for` sobre el array pasaria en
 * verde aunque el array estuviera vacio, que es el defecto del item 61 aplicado
 * a un test.
 */

describe('validateSlug', () => {
  describe('D8 - los 16 reservados', () => {
    it('son exactamente 16', () => {
      expect(RESERVED_SLUGS).toHaveLength(16)
    })

    it.each(RESERVED_SLUGS)('rechaza el reservado %s', (slug) => {
      expect(validateSlug(slug)).toBe('reserved')
      expect(isReservedSlug(slug)).toBe(true)
      expect(slugRejectionMessage('reserved')).toBeTruthy()
    })

    it('la lista no tiene duplicados', () => {
      expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length)
    })
  })

  describe('formato', () => {
    it('acepta minusculas, numeros y guiones internos', () => {
      expect(validateSlug('mi-tienda-2')).toBeNull()
      expect(validateSlug('abc')).toBeNull()
      expect(validateSlug('tienda123')).toBeNull()
    })

    it.each([
      ['Mayusculas', 'Tienda'],
      ['guion al inicio', '-tienda'],
      ['guion al final', 'tienda-'],
      ['guiones dobles', 'tienda--dos'],
      ['guion bajo', 'mi_tienda'],
      ['punto', 'mi.tienda'],
      ['espacio', 'mi tienda'],
      ['acentos', 'tiendañ'],
      ['slash', 'tienda/uno'],
    ])('rechaza %s', (_caso, slug) => {
      expect(validateSlug(slug)).toBe('invalid_format')
    })

    it('rechaza vacio con su propio motivo, no como formato', () => {
      expect(validateSlug('')).toBe('empty')
    })
  })

  describe('largo', () => {
    it(`rechaza menos de ${SLUG_MIN_LENGTH}`, () => {
      expect(validateSlug('ab')).toBe('too_short')
    })

    it(`rechaza mas de ${SLUG_MAX_LENGTH}`, () => {
      expect(validateSlug('a'.repeat(SLUG_MAX_LENGTH + 1))).toBe('too_long')
    })

    it('acepta los limites exactos', () => {
      expect(validateSlug('a'.repeat(SLUG_MIN_LENGTH))).toBeNull()
      expect(validateSlug('a'.repeat(SLUG_MAX_LENGTH))).toBeNull()
    })
  })

  /**
   * D8: `validateSlug` NO normaliza. Estos tests fijan esa decision, porque es
   * la clase de bug mas caro de todos: un slug normalizado en silencio parece
   * funcionar y falla mas tarde, en un DNS, en un link viejo o en un copy-paste.
   */
  describe('no normaliza (decision D8 / STOP 2)', () => {
    it('NO baja a minusculas: "MiTienda" es formato invalido, no "mitienda"', () => {
      expect(validateSlug('MiTienda')).toBe('invalid_format')
    })

    it('NO quita acentos: "tiendañ" es formato invalido', () => {
      expect(validateSlug('tiendañ')).toBe('invalid_format')
    })

    it('NO convierte espacios: "mi tienda" es formato invalido', () => {
      expect(validateSlug('mi tienda')).toBe('invalid_format')
    })

    it('"Admin" no colisiona con el reservado "admin": cada uno por su motivo', () => {
      // Si normalizara, "Admin" pasaria a ser "admin" y seria 'reserved'.
      // Como no normaliza, es 'invalid_format'. La distincion importa: el
      // endpoint devuelve 400 para formato y 409 para reservado.
      expect(validateSlug('Admin')).toBe('invalid_format')
      expect(validateSlug('admin')).toBe('reserved')
    })
  })

  describe('motivos y mensajes', () => {
    it('cada motivo tiene mensaje en espanol y ninguno queda vacio', () => {
      const reasons = [
        'empty',
        'invalid_format',
        'too_short',
        'too_long',
        'reserved',
      ] as const
      for (const reason of reasons) {
        expect(slugRejectionMessage(reason)).toBeTruthy()
      }
    })

    it('el motivo se puede usar para elegir el status code', () => {
      // El endpoint mapea: reservado -> 409, el resto -> 400. Si un motivo nuevo
      // no cayera en ninguna de las dos ramas, el status seria undefined.
      expect(validateSlug('admin')).toBe('reserved')
      expect(['empty', 'invalid_format', 'too_short', 'too_long']).toContain(
        validateSlug('A'),
      )
    })
  })
})

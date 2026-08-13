import { describe, it, expect } from 'vitest'
import { normalizeSlug } from '../utils'

describe('normalizeSlug', () => {
  it('should convert to lowercase', () => {
    expect(normalizeSlug('HELLO')).toBe('hello')
    expect(normalizeSlug('HeLLo')).toBe('hello')
  })

  it('should remove accents/diacritics', () => {
    expect(normalizeSlug('áéíóú')).toBe('aeiou')
    expect(normalizeSlug('ÁÉÍÓÚ')).toBe('aeiou')
    expect(normalizeSlug('ñandú')).toBe('nandu')
    expect(normalizeSlug('Mulder & Scully')).toBe('mulder-scully')
  })

  it('should replace spaces with hyphens', () => {
    expect(normalizeSlug('hello world')).toBe('hello-world')
    expect(normalizeSlug('multiple   spaces')).toBe('multiple-spaces')
  })

  it('should remove non-alphanumeric characters (except hyphens and spaces)', () => {
    expect(normalizeSlug('hello!@#$%^&*()')).toBe('hello')
    expect(normalizeSlug('product_123')).toBe('product123')
  })

  it('should replace multiple hyphens with single hyphen', () => {
    expect(normalizeSlug('hello--world')).toBe('hello-world')
    expect(normalizeSlug('a---b---c')).toBe('a-b-c')
  })

  it('should trim hyphens at start and end', () => {
    expect(normalizeSlug('-hello-')).toBe('hello')
    expect(normalizeSlug('--test--')).toBe('test')
  })

  it('should handle complex slug with all transformations', () => {
    expect(normalizeSlug('Categoría de Productos!   Áéíóú')).toBe(
      'categoria-de-productos-aeiou',
    )
    expect(normalizeSlug('  Múltiples   Espacios   ')).toBe(
      'multiples-espacios',
    )
  })

  it('should handle empty string', () => {
    expect(normalizeSlug('')).toBe('')
  })

  it('should handle string with only special characters', () => {
    expect(normalizeSlug('!@#$%^&*()')).toBe('')
  })
})

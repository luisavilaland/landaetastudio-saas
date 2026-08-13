import { describe, it, expect } from 'vitest'
import { validateEnv } from '../env'

describe('validateEnv', () => {
  it('should not throw when required env vars are present', () => {
    expect(() => validateEnv()).not.toThrow()
  })
})

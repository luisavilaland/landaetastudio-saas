import { describe, it, expect } from 'vitest'
import { createLogger, withContext } from '../index'

describe('createLogger', () => {
  it('should create a logger with expected methods', () => {
    const logger = createLogger('test-module')
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('should create a child logger with withContext', () => {
    const logger = createLogger('test-module')
    const child = withContext(logger, { tenantId: 'tenant-1' })
    expect(child).toBeDefined()
    expect(typeof child.info).toBe('function')
    expect(child).not.toBe(logger)
  })
})

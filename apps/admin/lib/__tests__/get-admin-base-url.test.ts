import { describe, expect, it } from 'vitest'
import { mockReq } from '@repo/test-utils'
import { getAdminBaseUrl } from '../get-admin-base-url'

function req(headers: Record<string, string>) {
  return mockReq('GET', undefined, headers)
}

describe('getAdminBaseUrl', () => {
  it('derives the URL from host and x-forwarded-proto over https', () => {
    const request = req({
      host: 'admin.landaetastudio.com',
      'x-forwarded-proto': 'https',
    })

    expect(getAdminBaseUrl(request)).toBe('https://admin.landaetastudio.com')
  })

  it('respects x-forwarded-proto when it says http', () => {
    const request = req({
      host: 'localhost:3001',
      'x-forwarded-proto': 'http',
    })

    expect(getAdminBaseUrl(request)).toBe('http://localhost:3001')
  })

  it('takes the first protocol when x-forwarded-proto is a comma separated list', () => {
    const request = req({
      host: 'admin.landaetastudio.com',
      'x-forwarded-proto': 'https,http',
    })

    expect(getAdminBaseUrl(request)).toBe('https://admin.landaetastudio.com')
  })

  it('defaults to https when the request has no x-forwarded-proto', () => {
    const request = req({ host: 'admin.landaetastudio.com' })

    expect(getAdminBaseUrl(request)).toBe('https://admin.landaetastudio.com')
  })

  it('keeps the port from the host header', () => {
    const request = req({ host: 'localhost:3001', 'x-forwarded-proto': 'http' })

    expect(getAdminBaseUrl(request)).toBe('http://localhost:3001')
  })

  it('throws instead of returning a broken URL when the host header is missing', () => {
    const request = req({ 'x-forwarded-proto': 'https' })

    expect(() => getAdminBaseUrl(request)).toThrow(/missing the host header/)
  })

  it('never reads a fixed base URL from the environment', () => {
    const original = process.env.ADMIN_URL
    const originalStorefront = process.env.STOREFRONT_URL
    process.env.ADMIN_URL = 'https://admin.invalido.com'
    process.env.STOREFRONT_URL = 'https://tienda.invalida.com'

    try {
      const request = req({
        host: 'admin.landaetastudio.com',
        'x-forwarded-proto': 'https',
      })

      expect(getAdminBaseUrl(request)).toBe('https://admin.landaetastudio.com')
    } finally {
      if (original === undefined) delete process.env.ADMIN_URL
      else process.env.ADMIN_URL = original
      if (originalStorefront === undefined) delete process.env.STOREFRONT_URL
      else process.env.STOREFRONT_URL = originalStorefront
    }
  })
})
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MercadoPagoApiError,
  MP_API,
  getAuthorizedPayment,
  getPayment,
  getPreapproval,
} from '../mp-subscriptions'

/**
 * Tests de los helpers de LECTURA contra la API de MercadoPago.
 *
 * Antes no habia ningun test de este modulo: el wrapper de T3 se exercito solo
 * de forma indirecta desde los endpoints de T4. `getPayment` (T5) vino sin tests
 * y el hook de pre-commit lo marco.
 *
 * El foco son las tres rutas de lectura, porque son las que el handler del
 * webhook usa y de las que depende el cruce correcto: son **recursos distintos**
 * y confundirlos devuelve 200 con datos que no son los buscados (el mismo
 * patron de "2xx silencioso" que documenta el spike T0).
 */

const TOKEN = 'APP_USR-test-token'

interface FetchCall {
  url: string
  init: RequestInit
}

function mockFetch(body: unknown, status = 200): FetchCall[] {
  const calls: FetchCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify(body), { status })
    }),
  )
  return calls
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getPayment', () => {
  it('consulta /v1/payments/{id} con el token en Authorization', async () => {
    const calls = mockFetch({ id: '181244133433', status: 'approved' })

    const result = await getPayment('181244133433', TOKEN)

    expect(calls[0].url).toBe(`${MP_API.baseUrl}/v1/payments/181244133433`)
    expect(calls[0].init.method).toBe('GET')
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${TOKEN}`)
    expect(result).toMatchObject({ status: 'approved' })
  })

  it('NO usa /authorized_payments: es otro recurso', async () => {
    // Confundir estos dos endpoints devuelve 200 con la invoice en vez del
    // pago, y el handler tomaria decisiones de transicion sobre el objeto
    // equivocado sin ningun error visible.
    const calls = mockFetch({ id: 'x', status: 'approved' })

    await getPayment('x', TOKEN)

    expect(calls[0].url).not.toContain('authorized_payments')
  })

  it('propaga MercadoPagoApiError con el status de MP', async () => {
    mockFetch({ message: 'Payment not found' }, 404)

    await expect(getPayment('nope', TOKEN)).rejects.toMatchObject({
      name: 'MercadoPagoApiError',
      status: 404,
    })
  })

  it('convierte un fallo de red en MercadoPagoApiError, no en TypeError', async () => {
    // El handler distingue los dos: un MercadoPagoApiError es "MP no
    // respondio", cualquier otra excepcion es un bug nuestro.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    await expect(getPayment('x', TOKEN)).rejects.toMatchObject({
      name: 'MercadoPagoApiError',
    })
  })

  it('propaga el timeout como MercadoPagoApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        throw e
      }),
    )

    await expect(getPayment('x', TOKEN, 10)).rejects.toMatchObject({
      name: 'MercadoPagoApiError',
      message: expect.stringContaining('timeout'),
    })
  })
})

describe('MercadoPagoApiError es una clase real', () => {
  it('instanceof funciona y el prototype queda en la cadena', async () => {
    mockFetch({ message: 'boom' }, 500)

    const err = await getPayment('x', TOKEN).catch((e: unknown) => e)

    // Con la asercion `new Error(msg) as MercadoPagoApiError` esto era `false`:
    // el objeto no heredaba de MercadoPagoApiError, asi que un `catch` solo
    // podia distinguir el error por el string de `name`.
    expect(err).toBeInstanceOf(MercadoPagoApiError)
    expect(err).toBeInstanceOf(Error)
  })

  it('los tres helpers propagan el mismo tipo de error', async () => {
    mockFetch({ message: 'boom' }, 500)

    const results = await Promise.allSettled([
      getPayment('x', TOKEN),
      getPreapproval('x', TOKEN),
      getAuthorizedPayment('x', TOKEN),
    ])

    for (const r of results) {
      expect(r.status).toBe('rejected')
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(MercadoPagoApiError)
      }
    }
  })

  it('marca los fallos de red con status 0 e isNetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    const err = await getPayment('x', TOKEN).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 0, isNetworkError: true })
  })
})

describe('getPreapproval', () => {
  it('consulta /preapproval/{id}', async () => {
    const calls = mockFetch({ id: '25f8cf82', status: 'authorized' })

    const result = await getPreapproval('25f8cf82', TOKEN)

    expect(calls[0].url).toBe(`${MP_API.baseUrl}/preapproval/25f8cf82`)
    expect(result).toMatchObject({ status: 'authorized' })
  })

  it('devuelve el external_reference, que es el cruce del fallback R', async () => {
    mockFetch({ id: 'x', status: 'authorized', external_reference: 'tenant-7' })

    const result = await getPreapproval('x', TOKEN)

    expect(result.external_reference).toBe('tenant-7')
  })
})

describe('getAuthorizedPayment', () => {
  it('consulta /authorized_payments/{id} y NO /v1/payments', async () => {
    const calls = mockFetch({ id: '7032544182', preapproval_id: '25f8cf82' })

    const result = await getAuthorizedPayment('7032544182', TOKEN)

    expect(calls[0].url).toBe(
      `${MP_API.baseUrl}/authorized_payments/7032544182`,
    )
    expect(result).toMatchObject({ preapproval_id: '25f8cf82' })
  })

  it('los tres helpers apuntan a paths distintos entre si', async () => {
    // La regresion que mas caro sale: los tres reciben un `data.id` que MP
    // documenta como "el id", pero cada topic significa una cosa distinta.
    const a = mockFetch({})
    await getPayment('ID', TOKEN)
    const b = mockFetch({})
    await getAuthorizedPayment('ID', TOKEN)
    const c = mockFetch({})
    await getPreapproval('ID', TOKEN)

    const urls = [a[0].url, b[0].url, c[0].url]
    expect(new Set(urls).size).toBe(3)
  })
})
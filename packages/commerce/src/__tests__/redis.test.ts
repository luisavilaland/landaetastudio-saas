import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests del CONTRATO de `redisPexpire` (item 66, H-F2-7).
 *
 * Antes de este archivo, `packages/commerce/src/redis.ts` no tenia **ningun** test:
 * sus funciones solo se ejercitaban de forma indirecta desde los endpoints. Eso deja
 * la firma sin verificar — cambiar `Promise<void>` a `Promise<boolean>` no lo atrapa
 * ningun control, y si un call site olvida manejar el `false` nada falla.
 *
 * El foco es el `boolean`, no el comando: `pexpire` tiene que poder afirmar "el TTL
 * quedo aplicado" o "no quedo", porque de eso depende que el rate limit se
 * autorepare.
 */

const { mockPexpire } = vi.hoisted(() => ({ mockPexpire: vi.fn() }))

vi.mock('ioredis', () => ({
  default: class MockRedis {
    // `ready` hace que `whenReady` no espere ningun evento: el test es del
    // contrato, no del ciclo de conexion.
    status = 'ready'
    on = vi.fn()
    once = vi.fn()
    off = vi.fn()
    connect = vi.fn(async () => undefined)
    get = vi.fn()
    setex = vi.fn()
    del = vi.fn()
    incr = vi.fn()
    pexpire = mockPexpire
    ping = vi.fn()
  },
}))

import { redisPexpire } from '../redis'

describe('redisPexpire — contrato (item 66)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve true cuando ioredis confirma que aplico el TTL', async () => {
    mockPexpire.mockResolvedValue(1)

    await expect(redisPexpire('rate_limit:x', 60_000)).resolves.toBe(true)
    expect(mockPexpire).toHaveBeenCalledWith('rate_limit:x', 60_000)
  })

  it('devuelve false si ioredis responde 0 (la clave no existe)', async () => {
    mockPexpire.mockResolvedValue(0)

    // 0 no es un error: es "no hay clave, no hay TTL". El caller tiene que poder
    // distinguirlo igual, porque el resultado seguro es el mismo: no hay TTL.
    await expect(redisPexpire('rate_limit:x', 60_000)).resolves.toBe(false)
  })

  it('devuelve false si el comando lanza — Redis degradado', async () => {
    mockPexpire.mockRejectedValue(new Error('Stream is not writeable'))

    // `safeRun` traga el error; lo que se verifica aca es que la degradacion
    // llegue al caller como `false` y no como una excepcion. Antes de item 66 el
    // retorno era `void`, asi que esto era indistinguible del exito.
    await expect(redisPexpire('rate_limit:x', 60_000)).resolves.toBe(false)
  })

  it('no propaga el error: el rate limit no puede tirar 500', async () => {
    mockPexpire.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      redisPexpire('rate_limit:x', 60_000),
    ).resolves.not.toThrow()
    await expect(redisPexpire('rate_limit:x', 60_000)).resolves.toBe(false)
  })
})
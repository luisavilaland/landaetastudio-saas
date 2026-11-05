import LogoutButton from '@/components/logout-button'

/**
 * Pagina de destino del bloqueo por `canAccessPanel: 'none'` (S4d).
 *
 * Vive **fuera** del grupo `(dashboard)` a proposito: ese layout hace `auth()` +
 * `redirect('/login')` y, mas importante, el proxy tiene que poder mandar aca
 * sin que el layout vuelva a decidir. Es una pagina terminal.
 *
 * No consulta sesion ni base de datos: si lo hiciera, un fallo de DB en el
 * camino de bloqueo dejaria al tenant sin pagina a la que caer.
 *
 * **Salida**: el tenant bloqueado tiene que poder irse. Sin el boton de logout
 * queda atrapado en una pagina que no ofrece ninguna accion y su unica salida
 * es borrar la cookie a mano.
 */

const supportEmail = process.env.SUPPORT_EMAIL

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Cuenta suspendida</h1>
          <p className="mt-2 text-sm text-zinc-600">
            El acceso al panel esta bloqueado por la plataforma.
          </p>
        </div>

        <div className="space-y-3 rounded-md bg-zinc-50 p-4 text-sm text-zinc-700">
          <p>
            Tus productos, pedidos y configuracion siguen guardados. No se
            borro nada.
          </p>
          <p>
            La suspension no es automatica ni por falta de pago: la decide el
            equipo de la plataforma. Escribinos para revisar el caso y
            reactivar el acceso.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}`}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
            >
              Escribir a soporte
            </a>
          ) : (
            <p className="text-center text-xs text-zinc-500">
              Contacta al soporte indicando el nombre de tu tienda.
            </p>
          )}
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}

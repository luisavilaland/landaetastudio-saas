/**
 * Pagina de destino del bloqueo por `canAccessPanel: 'none'` (S4d).
 *
 * Vive **fuera** del grupo `(dashboard)` a proposito: ese layout hace `auth()` +
 * `redirect('/login')` y, mas importante, el proxy tiene que poder mandar aca
 * sin que el layout vuelva a decidir. Es una pagina terminal.
 *
 * No consulta sesion ni base de datos: si lo hiciera, un fallo de DB en el
 * camino de bloqueo dejaria al tenant sin pagina a la que caer.
 */
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

        <p className="text-center text-xs text-zinc-500">
          Si crees que es un error, contacta al soporte indicando el nombre de
          tu tienda.
        </p>
      </div>
    </div>
  )
}

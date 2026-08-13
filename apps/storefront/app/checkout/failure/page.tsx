type Props = {
  searchParams: { order_id?: string }
}

export default async function CheckoutFailurePage({ searchParams }: Props) {
  const orderId = searchParams.order_id

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-600">
          El pago no se completó
        </h1>
        {orderId && <p className="mb-2 text-gray-600">Orden: {orderId}</p>}
        <p className="mb-6 text-gray-600">Por favor, intentá nuevamente.</p>
        <a href="/checkout" className="text-blue-600 hover:underline">
          Volver a intentar el pago
        </a>
      </div>
    </div>
  )
}

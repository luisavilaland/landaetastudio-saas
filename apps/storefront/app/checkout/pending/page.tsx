type Props = {
  searchParams: { order_id?: string }
}

export default async function CheckoutPendingPage({ searchParams }: Props) {
  const orderId = searchParams.order_id

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-yellow-600">
          Pago en proceso
        </h1>
        {orderId && <p className="mb-2 text-gray-600">Orden: {orderId}</p>}
        <p className="mb-6 text-gray-600">
          Tu pago está siendo procesado. Te avisaremos cuando se confirme.
        </p>
        <a href="/" className="text-blue-600 hover:underline">
          Volver a la tienda
        </a>
      </div>
    </div>
  )
}

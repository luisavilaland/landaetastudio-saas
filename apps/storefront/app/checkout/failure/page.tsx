type Props = {
  searchParams: { order_id?: string };
};

export default async function CheckoutFailurePage({ searchParams }: Props) {
  const orderId = searchParams.order_id;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          El pago no se completó
        </h1>
        {orderId && (
          <p className="text-gray-600 mb-2">
            Orden: {orderId}
          </p>
        )}
        <p className="text-gray-600 mb-6">
          Por favor, intentá nuevamente.
        </p>
        <a
          href="/checkout"
          className="text-blue-600 hover:underline"
        >
          Volver a intentar el pago
        </a>
      </div>
    </div>
  );
}
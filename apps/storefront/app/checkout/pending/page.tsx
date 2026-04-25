type Props = {
  searchParams: Promise<{ order_id?: string }>;
};

export default async function CheckoutPendingPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = params.order_id;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-yellow-600 mb-4">
          Pago en proceso
        </h1>
        {orderId && (
          <p className="text-gray-600 mb-2">
            Orden: {orderId}
          </p>
        )}
        <p className="text-gray-600 mb-6">
          Tu pago está siendo procesado. Te avisaremos cuando se confirme.
        </p>
        <a
          href="/"
          className="text-blue-600 hover:underline"
        >
          Volver a la tienda
        </a>
      </div>
    </div>
  );
}
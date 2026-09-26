---
name: webhook-debug
description: Usar al depurar o modificar el webhook de MercadoPago en landaetastudio-saas. Trigger - orden que no cambia de estado, pago que no llega, error de firma HMAC, webhook duplicado o no idempotente, testing del webhook con magic IDs, o cambios en los dos flujos de MP (suscripciones de plataforma vs ordenes de tienda del tenant, ADR-023).
---

# Debug del webhook de MercadoPago

## Ubicacion y flujo

Handler: `apps/storefront/app/api/webhooks/mercadopago/route.ts`

Secuencia real, en orden:

1. Leer `MERCADOPAGO_WEBHOOK_SECRET`. Si no esta, rechazar. No hay default, no hay modo degradado: sin secret el webhook no se procesa.
2. `verifyMercadoPagoSignature` desde `@repo/commerce/webhook-signature` valida el HMAC.
3. Extraer `body.data.id` como `paymentId`. Si falta, 400.
4. Determinar el tenant: `external_reference` del pago, o el header `x-test-order-id` para testing.
5. Consultar el estado del pago en la API de MercadoPago.
6. Chequear idempotencia: si `order.metadata.paymentId` ya esta seteado, el pago ya se proceso y se retorna temprano.
7. Actualizar la orden dentro de `withTenantContext`.

## Firma HMAC

`@repo/commerce/webhook-signature` exporta:

- `verifyMercadoPagoSignature(params)` para el handler.
- `makeSignature(params)` para tests, para no reimplementar el algoritmo en el E2E.

La firma se calcula sobre el cuerpo crudo de la request. Cualquier middleware que re-serialice el JSON antes de la validacion invalida la firma. Si las firmas empiezan a fallar sin cambios en MP, suspectar de un parser de body agregado en el path.

Magic IDs de testing:

| paymentId   | Estado simulado |
| ----------- | --------------- |
| `123456789` | approved        |
| `000000`    | rejected        |
| `999999`    | pending         |

Se activan con `NODE_ENV=development` o `E2E_WEBHOOK_TEST=1`. **No son un bypass de seguridad**: solo tienen efecto despues de que `verifyMercadoPagoSignature` confirma el HMAC con el secret real. `E2E_WEBHOOK_TEST=1` esta configurada en el entorno Preview de Vercel del storefront, y aplica a todos los previews porque Vercel no permite acotar por rama. Se acepta conscientemente: la firma sigue siendo el gate real.

## Idempotencia

El guard esta en `order.metadata.paymentId`. Ese es el mecanismo, no el `paymentId` de MP en otro lado de la fila.

Cuando audites idempotencia, verificá que la escritura de `metadata.paymentId` y la transicion de estado de la orden esten **en la misma transaccion**. Si el estado se actualiza en un bloque y el metadata en otro, un crash entre medio deja la orden en estado final sin marker de idempotencia, y el reintento de MP la procesa otra vez.

MercadoPago reintenta. El 200 tiene que ser rapido y la respuesta tiene que ser estable en el camino idempotente: si el segundo intento devuelve un error distinto al primero, MP lo registra como fallo y sigue reintentando.

## Testing manual

```bash
# Suscripcion aprobada
curl -X POST http://localhost:3000/api/webhooks/mercadopago \
  -H "content-type: application/json" \
  -H "x-signature: ts=<TIMESTAMP>,v1=<HMAC>" \
  -H "x-test-order-id: <TENANT_ID>:<ORDER_ID>" \
  -d '{"type":"payment","data":{"id":"123456789"}}'
```

`x-test-order-id` usa el formato de `external_reference`: `<tenantId>:<orderId>`. El header solo aplica en testing. El `id` del body debe ser uno de los magic IDs para que la simulacion aplique.

## E2E

`e2e/webhook/webhook-signature.spec.ts` firma con `makeSignature` usando `MERCADOPAGO_WEBHOOK_SECRET`, crea la orden directo en DB y verifica los tres estados (`confirmed`, `payment_failed`, `pending_payment`).

Variables requeridas en el runner: `DATABASE_URL` y `MERCADOPAGO_WEBHOOK_SECRET`. En Vercel, `E2E_WEBHOOK_TEST=1` en Preview.

Corre con `total=0` para no disparar emails durante el test.

## Los dos flujos de MP (ADR-023)

El proyecto tiene dos flujos de pago deliberadamente separados. Antes de tocar cualquier handler, confirmar cual es:

| Flujo             | Quien cobra                 | Access Token                              | Webhook Secret               |
| ----------------- | --------------------------- | ----------------------------------------- | ---------------------------- |
| Suscripciones     | Plataforma (LandaetaStudio) | `MP_PLATFORM_ACCESS_TOKEN`                | `MP_PLATFORM_WEBHOOK_SECRET` |
| Ordenes de tienda | El tenant, a sus clientes   | `tenant_mp_config.access_token` (cifrado) | `MERCADOPAGO_WEBHOOK_SECRET` |

El token que el tenant pega en el onboarding es **exclusivamente** para cobrar a sus clientes, nunca para pagar la suscripcion a la plataforma.

Consecuencia practica: los dos flujos necesitan **secretos de webhook distintos**. Reusar `MERCADOPAGO_WEBHOOK_SECRET` en el flujo de plataforma hace que toda peticion de un tenant falle la validacion HMAC del otro, o al reves. Si los logs muestran firmas invalidas de golpe en produccion, revisar si se mezclaron los secrets.

Referencia: `vault/01_ADRs/ADR-023-dos-flujos-mp.md`.

## Checklist de debug

- [ ] El secret que llega a la ruta es el del flujo correcto (ver tabla de ADR-023).
- [ ] El cuerpo crudo no fue re-serializado antes de `verifyMercadoPagoSignature`.
- [ ] `external_reference` trae formato `<tenantId>:<orderId>`. Si no lo trae, el handler responde con la rama de "orden pre-deploy, reconciliar manualmente" y no actualiza nada.
- [ ] La query de la orden esta dentro de `withTenantContext` con `return await`.
- [ ] El `access_token` se descifra desde `tenant_mp_config` con el tenant correcto.
- [ ] La escritura de estado y la de `metadata.paymentId` comparten transaccion.
- [ ] El endpoint de suscripciones (`/api/webhooks/mercadopago/subscriptions/:tenantId`) descrito en ADR-023 no esta implementado en la branch actual. Si el problema es del flujo de plataforma, verificar si esa ruta existe antes de depurar el codigo del flujo de tienda.

## Logs

El handler usa el logger de `@repo/logger`. Los puntos utiles ya estan instrumentados: pago recibido, `paymentId` y estado simulado, `paymentId` y status de la llamada a MP, error de fetch, pago ya procesado, y referencia de orden sin `tenantId`. Para diagnosticar, empezar por el `paymentId` en el log `Received webhook` y seguir esa linea.

Nunca agregar `console.log`: el proyecto exige `createLogger('nombre-modulo')`.

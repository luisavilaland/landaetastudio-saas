# Security Policy

## Versión actual

| Versión | Estado |
| ------- | ------ |
| 0.9.x   | Activo |

## Reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad, **no abras un issue público**. Enviá un email a la dirección de contacto del proyecto con:

1. Descripción del hallazgo.
2. Pasos para reproducir.
3. Impacto potencial (qué datos o servicios se ven afectados).

## Respuesta

- **Acuse de recibo:** dentro de las 48 horas hábiles.
- **Evaluación y fix:** depende de la gravedad — críticas se atienden en la semana, otros problemas en el siguiente release.
- **Disclosure:** se coordina la publicación del fix antes de dar details al reportador.

## Medidas de seguridad activas

- **RLS (Row Level Security):** FORCE ROW LEVEL SECURITY en todas las tablas de negocio con rol `app_user` (sin `BYPASSRLS`). Aislamiento multi-tenant garantizado a nivel de base de datos.
- **Autenticación:** NextAuth v5 con JWT, `AUTH_SECRET` obligatorio (sin fallback hardcoded).
- **Webhooks:** verificación HMAC con `timingSafeEqual`, anti-replay (ventana de 300s), fail-closed en producción.
- **Rate limiting:** 10 req/min/IP en checkout/preference con Redis.
- **Variables de entorno:** validación Zod al arrancar, la app no inicia si falta una variable crítica.
- **CSRF:** activado automáticamente por NextAuth v5 en producción.

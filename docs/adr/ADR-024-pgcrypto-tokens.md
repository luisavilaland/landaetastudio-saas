# ADR-024: Cifrado de tokens de MercadoPago con pgcrypto

**Fecha:** 2026-09-17
**Autor:** Equipo LandaetaStudio
**Estado:** Aceptado

> ⚠️ **Ver Enmienda 2026-09-18 al final de este documento.**
> El mecanismo de paso de la clave cambió de `SET LOCAL` a **bind param directo**. El cuerpo describe la decisión original; la enmienda fija la decisión final.

## Contexto

Los tenants configuran sus propias credenciales de MercadoPago (`ACCESS_TOKEN` + `WEBHOOK_SECRET`) para cobrar a sus clientes finales. Estas credenciales se almacenan en la tabla `tenant_mp_config` y son **secretos de alto valor**:

- Un `ACCESS_TOKEN` expuesto permite a un atacante cobrar en nombre del tenant, crear preferencias, reembolsar, acceder a datos de clientes.
- El `WEBHOOK_SECRET` permite falsificar notificaciones de pago.

La tabla tiene RLS (`tenant_isolation`) que protege contra *queries cruzadas entre tenants*, pero **RLS no protege contra**:
- Backup de base de datos expuesto (pg_dump, snapshot, point-in-time recovery).
- Un rol con `BYPASSRLS` (ej. `neondb_owner`, roles de administración de Neon).
- Acceso directo a la consola de Neon / dashboard de base de datos.
- Fuga de logs que incluyan la fila completa.

Por tanto, **defensa en profundidad** exige cifrar los tokens *antes* de persistirlos, de modo que sean inútiles sin la clave de descifrado.

## Decisión

Cifrado simétrico a nivel de aplicación usando **pgcrypto** (extensión nativa de PostgreSQL):

- **Algoritmo:** AES-256 (via `pgp_sym_encrypt` / `pgp_sym_decrypt`).
- **Clave maestra:** Variable de entorno `MP_TOKEN_ENCRYPTION_KEY` (base64, 32 bytes).
  - Generación: `openssl rand -base64 32`
  - **Nunca** en código, **nunca** en la base de datos, **nunca** en logs.
  - Solo en memoria del proceso (inyectada por Vercel / runtime).
- **Almacenamiento:** La tabla `tenant_mp_config` guarda `access_token_enc BYTEA` y `webhook_secret_enc BYTEA` (salida nativa de `pgp_sym_encrypt`, tipo `bytea`).
- **Schema completo:** la tabla también contiene `publicKey TEXT` y `isVerified BOOLEAN`; estas dos columnas fueron agregadas durante la implementación y están fuera del mínimo originalmente descrito por T4/ADR-024. La decisión de cifrado sigue enfocada únicamente sobre los dos campos de credenciales.
- **Descifrado:** Solo en memoria, en el momento de uso (checkout dinámico, validación de webhook del tenant). Nunca se loguea el valor descifrado.

```sql
-- ⚠️ Desactualizado: ver Enmienda 2026-09-18 (bind param directo)
-- Ejemplo de cifrado/descifrado con pgcrypto
INSERT INTO tenant_mp_config (tenant_id, access_token_enc, webhook_secret_enc)
VALUES (
  '...',
  pgp_sym_encrypt('APP_USR-xxxxx', current_setting('app.mp_encryption_key')),
  pgp_sym_encrypt('WHSEC_yyyyy', current_setting('app.mp_encryption_key'))
);

-- Lectura (en transacción con withTenantContext)
SELECT pgp_sym_decrypt(access_token_enc, current_setting('app.mp_encryption_key')) AS access_token
FROM tenant_mp_config WHERE tenant_id = current_setting('app.tenant_id');
```

La clave se setea por sesión vía `SET LOCAL app.mp_encryption_key = '...'` dentro de `withTenantContext` (o helper dedicado), igual que `app.tenant_id`. La clave **vive solo durante la transacción**; PostgreSQL la descarta al `COMMIT`. **No persiste en disco en la DB.**

### Riesgo: SQL logging

Si Neon tiene `log_statement = 'all'` o `log_min_duration_statement = 0`, el `SET LOCAL` con la clave queda registrado en texto plano en los logs de PostgreSQL.

**Mitigación:**
- Verificar la configuración de logging de Neon (por defecto no loguea `SET LOCAL`).
- Usar `set_config()` con query parameterizada en lugar de `SET LOCAL` con string interpolado:
  ```sql
  SELECT set_config('app.mp_encryption_key', $1, false);
  ```
  Así la clave viaja como parámetro y no como parte del texto SQL.

## Alternativas consideradas

1. **No cifrar (solo RLS):** Descartada. RLS es control de acceso a nivel de fila, no protección de datos en reposo. Un backup filtrado expone todos los tokens.
2. **Cifrado a nivel de DB con clave almacenada en la DB:** Descartada. "Security by obscurity" — si el atacante accede a la DB, también accede a la tabla de claves. Decorativo.
3. **KMS externo (AWS KMS, Google Cloud KMS, HashiCorp Vault):** Descartada para el MVP. Añade dependencia externa, latencia de red en cada checkout, costo operativo, y complejidad de rotación. Reevaluar si hay requisitos de compliance (PCI DSS, SOC2).
4. **Cifrado en aplicación (Node crypto) antes de INSERT:** Considerada. pgcrypto es preferible porque:
   - La clave se setea por sesión vía `SET LOCAL` / `set_config()`, vive solo en la transacción y PostgreSQL la descarta al `COMMIT`. No persiste en disco en la DB.
   - Funciona con cualquier cliente (psql, Drizzle, scripts de migración).
   - `pgp_sym_encrypt` incluye integrity check (detecta manipulación del ciphertext).

## Consecuencias

### Positivas
- **Defensa en profundidad real:** Token cifrado inútil sin `MP_TOKEN_ENCRYPTION_KEY`.
- **Cumplimiento implícito:** Cumple principio de "encryption at rest" para secretos de pago.
- **Rotación de clave posible:** Si se compromete la clave, se genera una nueva, se re-cifran todos los tokens existentes (migración one-off), se actualiza la env var.
- **Performance marginal:** `pgp_sym_encrypt/decrypt` ~0.5-1ms por operación. Despreciable vs latencia de red a MP.

### Negativas
- **Rotación de clave requiere migración de datos:** No es instantánea; script que recorre `tenant_mp_config` y re-cifra. Planificar ventana de mantenimiento.
- **Complejidad operativa:** Una variable de entorno crítica más (`MP_TOKEN_ENCRYPTION_KEY`). Si se pierde, **no hay recuperación** de los tokens existentes (los tenants deben re-ingresar credenciales).
- **Debugging limitado:** No se puede inspeccionar tokens en DB directamente. Herramientas de admin requieren función de descifrado controlada.

## Enmienda 2026-09-18 — Mecanismo de paso de la clave (bind param directo)

**Decisión final:** El helper de cifrado (`@repo/commerce/encryption`, Fase 1) NO usa `SET LOCAL` / `set_config` para la clave. La clave viaja como **parámetro bind** (bind param) directo a `pgp_sym_encrypt` / `pgp_sym_decrypt`:

```sql
-- Escritura
INSERT INTO tenant_mp_config (tenantId, accessTokenEnc, webhookSecretEnc)
VALUES ($1, pgp_sym_encrypt($2, $3), pgp_sym_encrypt($4, $3));

-- Lectura
SELECT pgp_sym_decrypt(accessTokenEnc, $3) AS access_token
FROM tenant_mp_config WHERE tenantId = $1;
```

Donde `$3` es `MP_TOKEN_ENCRYPTION_KEY` (bind param, nunca interpolada).

**Motivo:** mismo nivel de seguridad que `set_config` con query parameterizada (la clave nunca aparece en el texto SQL ni en logs), con menor superficie: no hace falta setear la clave en la sesión ni depurar leakage de `SET LOCAL` entre operaciones. El cuerpo de este ADR queda como especificación del *qué* (cifrado simétrico AES-256 con pgcrypto, BYTEA, clave fuera de la DB); esta enmienda fija el *cómo* de transporte de la clave en el helper.

## Referencias

- Blueprint v2.6: `docs/superpowers/specs/2026-09-blueprint-v2.6.md` (sección "Variables de entorno nuevas" → `MP_TOKEN_ENCRYPTION_KEY`)
- Blueprint v2.6: sección "Riesgos y mitigaciones" → "Fuga de tokens de MP si la base se filtra"
- ADR-023: Dos flujos MP (contexto de por qué existen `tenant_mp_config`)
- ADR-022: Estado real de RLS (por qué RLS no basta)
- Extensión pgcrypto: https://www.postgresql.org/docs/current/pgcrypto.html
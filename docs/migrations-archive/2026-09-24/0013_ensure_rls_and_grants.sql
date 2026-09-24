-- GRANTs para app_user (3 tablas nuevas)
GRANT SELECT, INSERT, UPDATE, DELETE ON plans TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_mp_config TO app_user;

-- ALTER DEFAULT PRIVILEGES (para tablas creadas por neondb_owner)
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- FORCE RLS idempotente en las 8 tablas existentes (con policies de 0009)
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods FORCE ROW LEVEL SECURITY;

-- NOTA: subscriptions y tenant_mp_config reciben ENABLE + FORCE RLS
-- + policies en T7. NO en esta migración.
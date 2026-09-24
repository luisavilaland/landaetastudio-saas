-- FORCE ROW LEVEL SECURITY — PR4
-- Aplica FORCE RLS para que las politicas tambien afecten al owner de la tabla
-- (neondb_owner). Sin FORCE, el owner bypassea RLS y ve todos los datos.

ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods FORCE ROW LEVEL SECURITY;

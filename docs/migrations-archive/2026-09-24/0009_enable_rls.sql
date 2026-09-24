-- RLS Migration - Fase 5
-- Enable Row Level Security on all business tables (excluding tenants and admin_users)

-- 1. Create helper function to set tenant_id in session
CREATE OR REPLACE FUNCTION set_tenant_id(tenant_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_id::text, true);
END;
$$ LANGUAGE plpgsql;

-- 2. Enable RLS on business tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;

-- 3. Create tenant_isolation policy for each table
CREATE POLICY tenant_isolation ON products
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON product_variants
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON product_images
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON categories
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON customers
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON orders
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON order_items
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON shipping_methods
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

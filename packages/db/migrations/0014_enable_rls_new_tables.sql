-- RLS para subscriptions y tenant_mp_config (T7 Fase 1)
-- Enable Row Level Security on the two new tables

-- 1. Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_mp_config ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS (so policies apply to table owner too)
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_mp_config FORCE ROW LEVEL SECURITY;

-- 3. Create tenant_isolation policy for each table
CREATE POLICY tenant_isolation ON subscriptions
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

CREATE POLICY tenant_isolation ON tenant_mp_config
  USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

-- NOTA: plans NO lleva RLS (catálogo global, sin tenantId).
-- T11 / D16: branding basico del tenant.
--
-- Solo `logoUrl`. `name` ya existe. `brandColor`, `description` y el resto van a
-- Fase 4, igual que `customDomain` (que ya esta en el schema pero necesita
-- emision y verificacion de DNS, que es otro flujo).
--
-- Nullable y sin default: un tenant sin logo es un tenant normal, no un tenant
-- a medio configurar. Si tuviera default, "nunca lo seteo" y "se puso el
-- default" serian el mismo estado, y no habria forma de distinguirlos.
--
-- `tenants` NO tiene RLS: es tabla raiz, y el checklist del repo prohibe RLS
-- sin `tenantId` + policy (`tenants` tiene `id`, no `tenantId`). Agregar una
-- columna no cambia eso y queda fuera del alcance de este PR.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "logoUrl" text;
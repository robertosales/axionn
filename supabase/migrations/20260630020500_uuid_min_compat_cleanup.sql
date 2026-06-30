-- Remove a compatibilidade usada apenas pelo backfill multi-tenant.

DROP AGGREGATE IF EXISTS public.min(uuid);
DROP FUNCTION IF EXISTS public.uuid_min_state(uuid, uuid);

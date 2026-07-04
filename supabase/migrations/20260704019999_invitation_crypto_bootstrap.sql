-- Compatibilidade temporária para criação das funções SQL de convite.
-- No Supabase local, pgcrypto reside em extensions; a migration seguinte
-- ainda é instalada com search_path restrito. O wrapper é removido pela
-- migration 20260704020001 após as funções finais serem endurecidas.

create or replace function public.digest(data text, digest_type text)
returns bytea
language sql
immutable
strict
security invoker
set search_path = extensions, pg_temp
as $$
  select extensions.digest(data, digest_type);
$$;

revoke all on function public.digest(text, text) from public, anon, authenticated;

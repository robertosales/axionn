-- Compatibilidade para o módulo RDM.
-- O banco histórico já possuía estas relações, mas a cadeia versionada não
-- garantia sua criação antes de 20260518220000_rdm_module.sql.

create table if not exists public.app_permissions (
  key text primary key,
  label text not null,
  description text,
  group_key text not null default 'general'
);

create table if not exists public.role_permissions (
  role_name text not null,
  permission_key text not null,
  primary key (role_name, permission_key)
);

comment on table public.role_permissions is
  'Mapa legado de permissões por papel, mantido até a migração para memberships organizacionais.';

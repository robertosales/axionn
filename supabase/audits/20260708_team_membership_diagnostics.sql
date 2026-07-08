-- Team & membership diagnostics
-- Uso: rodar com psql passando variáveis:
--   psql "$SUPABASE_DB_URL" -v user_email="'usuario@dominio'" -v org_id="'<uuid>'" \
--        -v team_names="ARRAY['GESP3','Nexo']" -f 20260708_team_membership_diagnostics.sql
-- Todas as consultas são somente-leitura; nenhuma alteração é feita.

\set ON_ERROR_STOP on

-- 1. Profile & atividade
select 'profile' as check, p.user_id, p.email, p.display_name, p.is_active, p.created_at
from public.profiles p
where p.email = :user_email;

-- 2. Membership na organização informada
select 'organization_member' as check,
       om.user_id, om.org_id, om.role, om.is_active, om.created_at, om.updated_at
from public.organization_members om
join public.profiles p on p.user_id = om.user_id
where p.email = :user_email
  and om.org_id = :org_id;

-- 3. Modules atribuídos ao membro
select 'organization_member_modules' as check,
       omm.user_id, omm.org_id, omm.module_key
from public.organization_member_modules omm
join public.profiles p on p.user_id = omm.user_id
where p.email = :user_email
  and omm.org_id = :org_id;

-- 4. Times pesquisados: org_id direto e resolvido
select 'team' as check,
       t.id, t.name, t.module, t.is_active,
       t.org_id as team_org_id,
       public.resolve_team_org_id(t.id) as resolved_org_id,
       (coalesce(t.org_id, public.resolve_team_org_id(t.id)) = :org_id) as belongs_to_target_org
from public.teams t
where t.name = ANY(:team_names);

-- 5. team_members para o usuário nesses times
select 'team_member' as check,
       tm.id as team_member_id, tm.team_id, t.name as team_name,
       tm.user_id, tm.role, tm.joined_at
from public.team_members tm
join public.teams t on t.id = tm.team_id
join public.profiles p on p.user_id = tm.user_id
where p.email = :user_email
  and t.name = ANY(:team_names);

-- 6. Platform admin?
select 'platform_admin' as check,
       p.user_id, coalesce(pua.role = 'platform_admin', false) as is_platform_admin
from public.profiles p
left join public.platform_user_roles pua on pua.user_id = p.user_id
where p.email = :user_email;

-- 7. Legacy user_roles (referência)
select 'legacy_user_roles' as check, ur.user_id, ur.role
from public.user_roles ur
join public.profiles p on p.user_id = ur.user_id
where p.email = :user_email;
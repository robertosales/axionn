begin;
create table public.apf_jira_webhook_integrations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id)on delete cascade,
 name text not null,base_url text not null,user_story_field_key text not null default'axionn_user_story_id',webhook_secret_encrypted text not null,
 is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,name)
);
alter table public.apf_jira_webhook_integrations enable row level security;
revoke all on public.apf_jira_webhook_integrations from public,anon,authenticated;
grant all on public.apf_jira_webhook_integrations to service_role;
create policy apf_jira_integrations_service_only on public.apf_jira_webhook_integrations for all to service_role using(true)with check(true);
comment on table public.apf_jira_webhook_integrations is'Configuração sigilosa do webhook Jira para ingestão APF; acesso exclusivo do service_role.';
commit;

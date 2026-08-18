create or replace function public.apf_can_access_model(_model_id uuid) returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $function$
  select exists (select 1 from public.apf_counting_models model join public.contracts contract on contract.id = model.contract_id where model.id = _model_id and contract.org_id = any(public.my_org_ids()));
$function$;

create or replace function public.apf_can_access_session(_session_id uuid) returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $function$
  select exists (select 1 from public.apf_counting_sessions session join public.projects project on project.id = session.project_id join public.contracts contract on contract.id = project.contract_id where session.id = _session_id and contract.org_id = any(public.my_org_ids()));
$function$;

create or replace function public.apf_can_access_baseline(_baseline_id uuid) returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $function$
  select exists (select 1 from public.apf_project_baselines baseline join public.projects project on project.id = baseline.project_id join public.contracts contract on contract.id = project.contract_id where baseline.id = _baseline_id and contract.org_id = any(public.my_org_ids()));
$function$;

drop policy if exists apf_models_select on public.apf_counting_models;
create policy apf_models_select on public.apf_counting_models for select to authenticated
using (contract_id in (select c.id from public.contracts c where c.org_id = any(public.my_org_ids())));

drop policy if exists apf_models_all on public.apf_counting_models;
create policy apf_models_all on public.apf_counting_models for all to authenticated
using (contract_id in (select c.id from public.contracts c where c.org_id = any(public.my_org_ids())))
with check (contract_id in (select c.id from public.contracts c where c.org_id = any(public.my_org_ids())));

drop policy if exists apf_sessions_all on public.apf_counting_sessions;
create policy apf_sessions_all on public.apf_counting_sessions for all to authenticated
using (project_id in (select p.id from public.projects p join public.contracts c on c.id = p.contract_id where c.org_id = any(public.my_org_ids())))
with check (project_id in (select p.id from public.projects p join public.contracts c on c.id = p.contract_id where c.org_id = any(public.my_org_ids())));

drop policy if exists apf_baselines_all on public.apf_project_baselines;
create policy apf_baselines_all on public.apf_project_baselines for all to authenticated
using (project_id in (select p.id from public.projects p join public.contracts c on c.id = p.contract_id where c.org_id = any(public.my_org_ids())))
with check (project_id in (select p.id from public.projects p join public.contracts c on c.id = p.contract_id where c.org_id = any(public.my_org_ids())));

drop policy if exists "Tenant members can read attachment objects" on storage.objects;
create policy "Tenant members can read attachment objects" on storage.objects for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    (storage.foldername(name))[1] = (auth.uid())::text
    or exists (select 1 from public.attachments a where a.file_path = storage.objects.name and public.can_view_team(auth.uid(), a.team_id))
    or exists (select 1 from public.demanda_evidencias e join public.demandas d on d.id = e.demanda_id where e.file_path = storage.objects.name and public.can_view_team(auth.uid(), d.team_id))
  )
);
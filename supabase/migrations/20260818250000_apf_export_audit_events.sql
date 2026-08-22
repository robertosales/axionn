begin;
create or replace function public.authorize_apf_dossier_export(p_dossier_id uuid)returns void language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
 perform public.apf_assert_dossier_permission(p_dossier_id,'apf.dossier.export');
 insert into public.apf_dossier_events(dossier_id,event_type,event_data)values(p_dossier_id,'exported',jsonb_build_object('scope','dossier'));
end $$;
create or replace function public.authorize_apf_batch_export(p_batch_id uuid)returns void language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare oid uuid;
begin
 select organization_id into oid from public.apf_measurement_batches where id=p_batch_id;
 if oid is null or not public.has_apf_dossier_permission(oid,'apf.dossier.export',auth.uid())then raise exception'Permissão APF insuficiente: apf.dossier.export'using errcode='42501';end if;
 insert into public.apf_dossier_events(dossier_id,event_type,event_data)
 select dossier_id,'exported',jsonb_build_object('scope','measurement_batch','batch_id',p_batch_id)from public.apf_measurement_batch_dossiers where batch_id=p_batch_id;
end $$;
commit;

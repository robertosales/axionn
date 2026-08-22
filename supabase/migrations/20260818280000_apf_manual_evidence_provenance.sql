begin;
create or replace function public.apf_enforce_manual_evidence_provenance()returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if current_user='authenticated'and(new.metadata->>'manual_evidence')is distinct from'true'then raise exception'Evidência direta deve ser identificada como manual.'using errcode='22023';end if;
 if current_user='authenticated'and nullif(trim(new.metadata->>'justification'),'')is null then raise exception'Justificativa da evidência manual é obrigatória.'using errcode='22023';end if;
 return new;
end $$;
drop trigger if exists apf_manual_evidence_provenance_guard on public.apf_evidence_sources;
create trigger apf_manual_evidence_provenance_guard before insert or update on public.apf_evidence_sources for each row execute function public.apf_enforce_manual_evidence_provenance();
commit;

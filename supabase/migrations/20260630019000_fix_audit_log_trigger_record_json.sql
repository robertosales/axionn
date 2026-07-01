-- Corrige a leitura genérica de registros compostos no trigger de auditoria.
-- O operador ->> só é válido para JSON/JSONB, não diretamente para NEW/OLD.

create or replace function public.audit_log_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
  v_record_id text;
  v_old_data jsonb;
  v_new_data jsonb;
begin
  begin
    v_actor_id := auth.uid();
  exception when others then
    v_actor_id := null;
  end;

  if v_actor_id is not null then
    select email
      into v_actor_email
      from auth.users
     where id = v_actor_id;
  end if;

  if tg_op = 'DELETE' then
    v_old_data := to_jsonb(old);
    v_new_data := null;
    v_record_id := coalesce(
      v_old_data ->> 'id',
      v_old_data ->> 'user_id'
    );
  elsif tg_op = 'INSERT' then
    v_old_data := null;
    v_new_data := to_jsonb(new);
    v_record_id := coalesce(
      v_new_data ->> 'id',
      v_new_data ->> 'user_id'
    );
  else
    v_old_data := to_jsonb(old);
    v_new_data := to_jsonb(new);
    v_record_id := coalesce(
      v_new_data ->> 'id',
      v_new_data ->> 'user_id'
    );
  end if;

  v_old_data := v_old_data
    - 'password'
    - 'encrypted_password'
    - 'must_change_password';
  v_new_data := v_new_data
    - 'password'
    - 'encrypted_password'
    - 'must_change_password';

  insert into public.audit_log (
    actor_id,
    actor_email,
    table_name,
    operation,
    record_id,
    old_data,
    new_data
  ) values (
    v_actor_id,
    v_actor_email,
    tg_table_name,
    tg_op,
    v_record_id,
    v_old_data,
    v_new_data
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_log_trigger_fn() from public, anon, authenticated;
grant execute on function public.audit_log_trigger_fn() to service_role;

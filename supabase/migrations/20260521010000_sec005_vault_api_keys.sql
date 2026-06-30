-- SEC-005 — API keys de IA no Supabase Vault.
-- Bancos locais sem a extensão recebem somente stubs que falham fechados.

begin;

do $$
begin
  if exists (
    select 1
    from pg_available_extensions
    where name = 'vault'
  ) then
    execute 'create extension if not exists vault with schema vault';
  end if;
end;
$$;

do $migration$
begin
  if to_regclass('vault.secrets') is not null
     and to_regclass('vault.decrypted_secrets') is not null then
    execute $function$
      create or replace function public.set_ai_provider_key(
        p_provider text,
        p_key text
      )
      returns void
      language plpgsql
      security definer
      set search_path = public, vault, pg_temp
      as $body$
      declare
        v_secret_name text := 'ai_provider_key_' || p_provider;
        v_existing_id uuid;
      begin
        if not public.is_admin() then
          raise exception 'Apenas administradores podem configurar API keys';
        end if;

        if p_provider not in ('lovable', 'openai', 'gemini', 'anthropic', 'perplexity') then
          raise exception 'Provider inválido: %', p_provider;
        end if;

        if p_key is null or length(trim(p_key)) < 10 then
          raise exception 'API key inválida ou muito curta';
        end if;

        select secret.id
          into v_existing_id
          from vault.secrets secret
         where secret.name = v_secret_name
         limit 1;

        if v_existing_id is not null then
          perform vault.update_secret(v_existing_id, p_key);
        else
          perform vault.create_secret(
            p_key,
            v_secret_name,
            'API key do provider ' || p_provider || ' para o apf-generate'
          );
        end if;
      end;
      $body$
    $function$;

    execute $function$
      create or replace function public.get_ai_provider_key(p_provider text)
      returns text
      language plpgsql
      security definer
      set search_path = public, vault, pg_temp
      as $body$
      declare
        v_key text;
      begin
        select secret.decrypted_secret
          into v_key
          from vault.decrypted_secrets secret
         where secret.name = 'ai_provider_key_' || p_provider
         limit 1;

        if v_key is null then
          raise exception 'API key não configurada para o provider: %', p_provider;
        end if;

        return v_key;
      end;
      $body$
    $function$;

    execute $view$
      create or replace view public.ai_provider_keys_status
      with (security_invoker = true)
      as
      select
        replace(secret.name, 'ai_provider_key_', '') as provider,
        secret.created_at,
        secret.updated_at,
        true as configured
      from vault.secrets secret
      where secret.name like 'ai_provider_key_%'
    $view$;
  else
    create or replace function public.set_ai_provider_key(
      p_provider text,
      p_key text
    )
    returns void
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $body$
    begin
      raise exception 'vault_unavailable';
    end;
    $body$;

    create or replace function public.get_ai_provider_key(p_provider text)
    returns text
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $body$
    begin
      raise exception 'vault_unavailable';
    end;
    $body$;

    create or replace view public.ai_provider_keys_status
    with (security_invoker = true)
    as
    select
      null::text as provider,
      null::timestamptz as created_at,
      null::timestamptz as updated_at,
      false as configured
    where false;
  end if;
end;
$migration$;

revoke all on function public.set_ai_provider_key(text, text) from public;
grant execute on function public.set_ai_provider_key(text, text) to authenticated;

revoke all on function public.get_ai_provider_key(text) from public, anon, authenticated;
grant execute on function public.get_ai_provider_key(text) to service_role;

revoke all on public.ai_provider_keys_status from public;
grant select on public.ai_provider_keys_status to authenticated;

commit;

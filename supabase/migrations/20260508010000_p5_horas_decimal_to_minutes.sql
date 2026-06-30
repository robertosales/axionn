-- MIGRAÇÃO P5 — Sustentação: conversão de horas decimais para minutos inteiros.
-- A versão possui timestamp único para não colidir com 20260508_impediment_started_at.sql.

begin;

create table if not exists public.migration_demanda_hours_log (
  id bigserial primary key,
  run_at timestamptz not null default now(),
  hour_id uuid not null,
  demanda_id uuid not null,
  user_id uuid not null,
  fase text not null,
  horas_antes numeric not null,
  horas_depois numeric not null,
  status text not null,
  nota text
);

comment on table public.migration_demanda_hours_log is
  'Log de auditoria da migração P5 — conversão decimal para minutos em demanda_hours.';

create table if not exists public._backup_demanda_hours_p5 as
select
  id,
  demanda_id,
  user_id,
  fase,
  horas as horas_original,
  descricao,
  created_at,
  now() as backup_at
from public.demanda_hours
where horas <> floor(horas)
  and horas <> 0;

comment on table public._backup_demanda_hours_p5 is
  'Backup dos registros decimais anteriores à migração P5.';

with registros_a_converter as (
  select hour.id, hour.horas
  from public.demanda_hours hour
  where hour.horas <> floor(hour.horas)
    and hour.horas <> 0
    and not exists (
      select 1
      from public.migration_demanda_hours_log log
      where log.hour_id = hour.id
        and log.status = 'converted'
    )
),
conversao as (
  update public.demanda_hours hour
  set horas = round(hour.horas * 60)
  from registros_a_converter source
  where hour.id = source.id
  returning
    hour.id,
    hour.demanda_id,
    hour.user_id,
    hour.fase,
    source.horas as horas_antes,
    hour.horas as horas_depois
)
insert into public.migration_demanda_hours_log (
  hour_id,
  demanda_id,
  user_id,
  fase,
  horas_antes,
  horas_depois,
  status,
  nota
)
select
  conversion.id,
  conversion.demanda_id,
  conversion.user_id,
  conversion.fase,
  conversion.horas_antes,
  conversion.horas_depois,
  'converted',
  'Decimal convertido para minutos inteiros pela migração P5'
from conversao conversion;

insert into public.migration_demanda_hours_log (
  hour_id,
  demanda_id,
  user_id,
  fase,
  horas_antes,
  horas_depois,
  status,
  nota
)
select
  hour.id,
  hour.demanda_id,
  hour.user_id,
  hour.fase,
  hour.horas,
  hour.horas,
  'zero_skipped',
  'Registro com horas igual a zero; revisar manualmente'
from public.demanda_hours hour
where hour.horas = 0
  and not exists (
    select 1
    from public.migration_demanda_hours_log log
    where log.hour_id = hour.id
      and log.status = 'zero_skipped'
  );

insert into public.migration_demanda_hours_log (
  hour_id,
  demanda_id,
  user_id,
  fase,
  horas_antes,
  horas_depois,
  status,
  nota
)
select
  hour.id,
  hour.demanda_id,
  hour.user_id,
  hour.fase,
  hour.horas,
  hour.horas,
  'already_integer',
  'Valor já era inteiro; nenhuma conversão realizada'
from public.demanda_hours hour
where hour.horas = floor(hour.horas)
  and hour.horas <> 0
  and not exists (
    select 1
    from public.migration_demanda_hours_log log
    where log.hour_id = hour.id
      and log.status = 'already_integer'
  );

commit;

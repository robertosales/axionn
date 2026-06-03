-- Fase 2: adiciona contract_id na tabela projetos
-- Vinculo opcional: um projeto pode ou nao pertencer a um contrato
alter table public.projetos
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;

comment on column public.projetos.contract_id is
  'Contrato de fabrica ao qual este projeto pertence (opcional)';

-- Index para listagem de projetos por contrato
create index if not exists idx_projetos_contract_id
  on public.projetos(contract_id)
  where contract_id is not null;

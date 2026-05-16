-- Migration: persist APF generation results
-- Adds columns to apf_generations to store the generated document,
-- pf totals per HU, and the storage path of the docx file.

alter table public.apf_generations
  add column if not exists output_markdown  text,
  add column if not exists pf_total         integer,
  add column if not exists pf_breakdown     jsonb,
  add column if not exists storage_path     text;

comment on column public.apf_generations.output_markdown is
  'Markdown gerado pela IA — conteúdo do documento de evidência APF';

comment on column public.apf_generations.pf_total is
  'Total de PF gerado nesta contagem (soma de todas as HUs)';

comment on column public.apf_generations.pf_breakdown is
  'PF por HU: { "HU 10266": 34, "HU 10267": 23, "__total": 57 }';

comment on column public.apf_generations.storage_path is
  'Caminho do arquivo .docx no Supabase Storage (bucket: apf-documents)';

-- Cria o bucket apf-documents se não existir (idempotente via DO block)
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('apf-documents', 'apf-documents', false)
  on conflict (id) do nothing;
end $$;

-- Policy: apenas usuários autenticados do mesmo team podem acessar
create policy "apf_documents_team_access"
  on storage.objects
  for all
  using (
    bucket_id = 'apf-documents'
    and auth.role() = 'authenticated'
  );

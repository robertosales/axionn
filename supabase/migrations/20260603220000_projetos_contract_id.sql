-- Vincula opcionalmente o projeto legado a um contrato.

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS contract_id uuid
    REFERENCES public.contracts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projetos.contract_id IS
  'Contrato ao qual o projeto legado pertence; vínculo opcional.';

CREATE INDEX IF NOT EXISTS idx_projetos_contract_id
  ON public.projetos(contract_id)
  WHERE contract_id IS NOT NULL;

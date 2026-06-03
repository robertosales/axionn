-- ============================================================
-- FIX: contract_slas — garante coluna priority
-- Corrige ambientes onde a coluna foi criada como criticidade.
-- Idempotente: só renomeia se criticidade ainda existir.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'contract_slas'
      AND column_name  = 'criticidade'
  ) THEN
    ALTER TABLE public.contract_slas RENAME COLUMN criticidade TO priority;
  END IF;
END;
$$;

-- Recria trigger de updated_at (idempotente)
DROP TRIGGER IF EXISTS trg_contract_slas_updated_at ON public.contract_slas;
CREATE TRIGGER trg_contract_slas_updated_at
  BEFORE UPDATE ON public.contract_slas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ============================================================
-- APF/PFS — correção de auditoria histórica e revisão de fator.
--
-- 1. Contagens históricas permanecem identificadas como legado preservado.
-- 2. Fallback conservador de fator exige revisão humana antes da contagem.
-- ============================================================

-- --------------------------------------------------------------------------
-- 1. Preserva a origem real das análises históricas já materializadas.
--
-- A migration inicial recalculou metadados de fonte para preencher as novas
-- colunas. Quando o fator resultante coincidia com o histórico, algumas
-- análises antigas ficaram marcadas como explicit_rule, embora essa regra não
-- tivesse participado da decisão original. Os itens dessas análises foram
-- marcados como legacy/legacy_central no backfill, permitindo identificá-las
-- sem depender de uma data de corte.
-- --------------------------------------------------------------------------
UPDATE public.apf_process_analysis_runs run
SET factor_source = 'legacy_preserved',
    factor_confidence = NULL,
    factor_review_required = false,
    factor_reasoning = 'Fator histórico preservado porque a análise já havia sido materializada.',
    confirmed_factor_sigla = coalesce(run.confirmed_factor_sigla, run.inferred_factor_sigla),
    updated_at = now()
WHERE run.materialized_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.apf_process_analysis_items process
    WHERE process.analysis_run_id = run.id
      AND process.decision_source IN ('legacy', 'legacy_central')
  );

-- --------------------------------------------------------------------------
-- 2. Fallback conservador e demais fatores pendentes obrigam revisão.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_apf_conservative_process_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_process_id UUID;
BEGIN
  IF OLD.process_count = 0 AND NEW.process_count > 0 THEN
    SELECT process.id
    INTO v_primary_process_id
    FROM public.apf_process_analysis_items process
    WHERE process.analysis_run_id = NEW.id
      AND (
        process.should_count = true
        OR process.recommendation IN ('send', 'send_with_validation')
      )
    ORDER BY
      CASE WHEN process.is_central THEN 0 ELSE 1 END,
      CASE WHEN process.selected_baseline_item_id IS NOT NULL THEN 0 ELSE 1 END,
      process.confidence DESC NULLS LAST,
      process.sort_order
    LIMIT 1;

    UPDATE public.apf_process_analysis_items process
    SET selected_by_default = process.id = v_primary_process_id,
        should_count = process.id = v_primary_process_id,
        decision_source = CASE
          WHEN process.id = v_primary_process_id THEN 'policy_default'
          ELSE 'candidate_only'
        END,
        updated_at = now()
    WHERE process.analysis_run_id = NEW.id;

    NEW.countable_process_count := CASE WHEN v_primary_process_id IS NULL THEN 0 ELSE 1 END;

    IF NEW.process_count > 1 THEN
      NEW.status := 'review_required';
      NEW.review_process_count := greatest(NEW.review_process_count, 1);
      NEW.status_reason := concat_ws(
        ' ',
        format(
          '%s processos candidatos foram identificados; somente o processo principal elegível foi pré-selecionado. Os demais permanecem visíveis para decisão humana.',
          NEW.process_count
        ),
        nullif(NEW.status_reason, '')
      );
    ELSIF v_primary_process_id IS NULL THEN
      NEW.status := 'review_required';
      NEW.review_process_count := greatest(NEW.review_process_count, 1);
      NEW.status_reason := concat_ws(
        ' ',
        'Nenhum processo elegível pôde ser pré-selecionado; a decisão humana é obrigatória.',
        nullif(NEW.status_reason, '')
      );
    END IF;
  END IF;

  IF NEW.factor_review_required THEN
    NEW.status := 'review_required';
    NEW.review_process_count := greatest(NEW.review_process_count, 1);
    NEW.status_reason := concat_ws(
      ' ',
      'O fator de impacto foi definido por fallback conservador e deve ser revisado antes da materialização.',
      nullif(NEW.status_reason, '')
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_apf_conservative_process_defaults() IS
  'Seleciona somente o processo principal por padrão e exige revisão para múltiplos processos ou fator pendente.';

-- ============================================================
-- MIGRATION: Multi-Tenancy + APF Engine — SEED PADRÃO
-- Arquivo:   20260620_003_multi_tenancy_apf_engine.sql
-- Branch:    feat/multi-tenancy-apf-engine
-- Data:      2026-06-20
-- Descrição: Seed dos dados mestre do motor APF.
--            Cria uma função RPC para provisionar um modelo
--            APF completo (PFS/DPF) em qualquer contrato,
--            com todos os tipos de função, 34 fatores de
--            impacto, categorias, regras e template de evidência.
-- ============================================================

-- ============================================================
-- BLOCO 1: RPC — provision_apf_model_pfs_dpf
-- Cria e popula um modelo APF PFS/DPF completo para um contrato.
-- Idempotente: se já existir modelo para o contrato, retorna o id existente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.provision_apf_model_pfs_dpf(
  p_contract_id UUID,
  p_model_name  TEXT DEFAULT 'Modelo PFS/DPF — GlobalWeb'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_model_id UUID;
BEGIN

  -- -------------------------------------------------------
  -- 1. Modelo base
  -- -------------------------------------------------------
  INSERT INTO public.apf_counting_models (contract_id, name, description, standard, is_active)
  VALUES (
    p_contract_id,
    p_model_name,
    'Modelo de contagem APF baseado no padrão PFS/DPF — Guia de Métricas GlobalWeb / SISP 4.3',
    'pfs_dpf',
    true
  )
  ON CONFLICT (contract_id) DO UPDATE
    SET name        = EXCLUDED.name,
        updated_at  = now()
  RETURNING id INTO v_model_id;

  -- -------------------------------------------------------
  -- 2. Tipos de função (apf_function_types)
  -- -------------------------------------------------------
  INSERT INTO public.apf_function_types (model_id, sigla, name, func_class, weight, sort_order)
  VALUES
    (v_model_id, 'TRN', 'Transação',                         'transactional', 4.60,  1),
    (v_model_id, 'ARQ', 'Arquivo',                            'data',          7.00,  2),
    (v_model_id, 'EI',  'Entrada Externa',                    'transactional', 4.00,  3),
    (v_model_id, 'EO',  'Saída Externa',                      'transactional', 5.00,  4),
    (v_model_id, 'EQ',  'Consulta Externa',                   'transactional', 3.00,  5),
    (v_model_id, 'ILF', 'Arquivo Lógico Interno',             'data',          7.00,  6),
    (v_model_id, 'EIF', 'Arquivo de Interface Externa',       'data',          5.00,  7)
  ON CONFLICT (model_id, sigla) DO UPDATE
    SET name       = EXCLUDED.name,
        weight     = EXCLUDED.weight,
        sort_order = EXCLUDED.sort_order;

  -- -------------------------------------------------------
  -- 3. Fatores de impacto — 34 fatores DPF-GlobalWeb
  -- -------------------------------------------------------
  INSERT INTO public.apf_impact_factors
    (model_id, sigla, name, contribution_pct, action_on_baseline, origin, is_inm, sort_order)
  VALUES
    -- Fatores de Inclusão/Alteração plena
    (v_model_id, 'I',      'Inclusão',                            100.00, 'Incluir/Alterar', 'Guia de Métricas DPF',  false,  1),
    (v_model_id, 'A',      'Alteração',                           60.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false,  2),
    (v_model_id, 'A75',    'Alteração 75%',                       75.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false,  3),
    (v_model_id, 'A100',   'Alteração 100%',                      100.00, 'Incluir/Alterar', 'Guia de Métricas DPF',  false,  4),
    -- Fatores de Conversão
    (v_model_id, 'COR50',  'Conversão 50%',                       50.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false,  5),
    (v_model_id, 'COR75',  'Conversão 75%',                       75.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false,  6),
    (v_model_id, 'COR100', 'Conversão 100%',                      100.00, 'Incluir/Alterar', 'Guia de Métricas DPF',  false,  7),
    -- Fatores de Garantia / Manutenção
    (v_model_id, 'GAR',    'Garantia',                            0.00,   'Não Impacta',     'Guia de Métricas DPF',  false,  8),
    (v_model_id, 'MAN',    'Manutenção Evolutiva',                50.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false,  9),
    (v_model_id, 'MAN75',  'Manutenção Evolutiva 75%',            75.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 10),
    -- Exclusão
    (v_model_id, 'E',      'Exclusão',                            0.00,   'Remover',         'Guia de Métricas DPF',  false, 11),
    -- Reuso
    (v_model_id, 'R',      'Reuso',                               20.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 12),
    (v_model_id, 'R50',    'Reuso 50%',                           50.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 13),
    -- Itens Não Mensuráveis
    (v_model_id, 'NM',     'Não Mensurável',                      0.00,   'Não Impacta',     'Guia de Métricas DPF',  true,  14),
    (v_model_id, 'NM-DOC', 'Não Mensurável — Documentação',       0.00,   'Não Impacta',     'Guia de Métricas DPF',  true,  15),
    (v_model_id, 'NM-INF', 'Não Mensurável — Infraestrutura',     0.00,   'Não Impacta',     'Guia de Métricas DPF',  true,  16),
    (v_model_id, 'NM-TST', 'Não Mensurável — Teste',              0.00,   'Não Impacta',     'Guia de Métricas DPF',  true,  17),
    (v_model_id, 'NM-SUP', 'Não Mensurável — Suporte',            0.00,   'Não Impacta',     'Guia de Métricas DPF',  true,  18),
    (v_model_id, 'NM-REG', 'Não Mensurável — Regulatório',        0.00,   'Não Impacta',     'Guia de Métricas DPF',  true,  19),
    -- SISP 4.3
    (v_model_id, 'MP',     'Melhoria de Processo',                30.00,  'Incluir/Alterar', 'SISP - 4.3',            false, 20),
    (v_model_id, 'AC',     'Acesso / Consulta',                   25.00,  'Incluir/Alterar', 'SISP - 4.3',            false, 21),
    (v_model_id, 'INT',    'Integração',                          60.00,  'Incluir/Alterar', 'SISP - 4.3',            false, 22),
    (v_model_id, 'INT50',  'Integração 50%',                      50.00,  'Incluir/Alterar', 'SISP - 4.3',            false, 23),
    (v_model_id, 'MIG',    'Migração de Dados',                   50.00,  'Incluir/Alterar', 'SISP - 4.3',            false, 24),
    (v_model_id, 'MIG75',  'Migração de Dados 75%',               75.00,  'Incluir/Alterar', 'SISP - 4.3',            false, 25),
    (v_model_id, 'IMP',    'Implantação',                         40.00,  'Incluir/Alterar', 'SISP - 4.3',            false, 26),
    -- Fatores complementares de contagem complexa
    (v_model_id, 'EXP',    'Expansão de Funcionalidade',          80.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 27),
    (v_model_id, 'REF',    'Refatoração Funcional',               30.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 28),
    (v_model_id, 'COR',    'Correção com Impacto Funcional',      40.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 29),
    (v_model_id, 'COR25',  'Correção com Impacto Funcional 25%',  25.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 30),
    -- Fatores de interface / layout
    (v_model_id, 'IU',     'Interface de Usuário — Nova',         100.00, 'Incluir/Alterar', 'Guia de Métricas DPF',  false, 31),
    (v_model_id, 'IU50',   'Interface de Usuário — Alteração',    50.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 32),
    -- Fatores de relatório / BI
    (v_model_id, 'REL',    'Relatório / Dashboard Novo',          100.00, 'Incluir/Alterar', 'Guia de Métricas DPF',  false, 33),
    (v_model_id, 'REL50',  'Relatório / Dashboard Alteração',     50.00,  'Incluir/Alterar', 'Guia de Métricas DPF',  false, 34)
  ON CONFLICT (model_id, sigla) DO UPDATE
    SET name             = EXCLUDED.name,
        contribution_pct = EXCLUDED.contribution_pct,
        action_on_baseline = EXCLUDED.action_on_baseline,
        sort_order       = EXCLUDED.sort_order;

  -- -------------------------------------------------------
  -- 4. Categorias funcionais
  -- -------------------------------------------------------
  INSERT INTO public.apf_categories (model_id, sigla, name, description)
  VALUES
    (v_model_id, 'ARN', 'Navegação / Interface',    'Telas, menus, fluxos de navegação e componentes de UI'),
    (v_model_id, 'ADS', 'Dados / Persistência',     'Entidades, arquivos, integrações e operações sobre dados'),
    (v_model_id, 'ATD', 'Técnico / Infraestrutura', 'Itens técnicos: jobs, APIs, segurança, configuração'),
    (v_model_id, 'AGR', 'Regulatório / Governo',    'Requisitos normativos, legais ou de auditoria'),
    (v_model_id, 'NM',  'Não Mensurável',           'Itens fora do escopo de contagem APF')
  ON CONFLICT (model_id, sigla) DO UPDATE
    SET name        = EXCLUDED.name,
        description = EXCLUDED.description;

  -- -------------------------------------------------------
  -- 5. Regras de contagem (prompt dinâmico)
  -- -------------------------------------------------------
  INSERT INTO public.apf_counting_rules (
    model_id,
    rule_mission,
    rule_fundamental_principle,
    rule_decision_hierarchy,
    rule_critical_guidelines,
    rule_elementary_process,
    rule_granularity,
    rule_precedence_override,
    rule_closure,
    rule_contractual_consistency
  ) VALUES (
    v_model_id,

    -- rule_mission
    'Você é um especialista sênior em Análise de Pontos de Função (APF) com certificação CFPS, '
    'especializado no padrão PFS/DPF do Guia de Métricas GlobalWeb e SISP 4.3. '
    'Sua missão é contar com precisão, consistência e rastreabilidade cada Elemento Funcional (EF) '
    'desenvolvido no sprint informado.',

    -- rule_fundamental_principle
    'PRINCÍPIO FUNDAMENTAL: A HU (História de Usuário) é apenas o GATILHO da contagem — '
    'ela descreve a necessidade do usuário. O OBJETO de contagem é sempre o Elemento Funcional (EF): '
    'a transação ou arquivo que implementa aquela necessidade. '
    'Nunca conte a HU — conte os EFs que ela gera.',

    -- rule_decision_hierarchy
    E'HIERARQUIA DE DECISÃO (seguir nesta ordem):\n'
    '1. Precedente homologado no histórico do time para o mesmo tipo de EF\n'
    '2. Regras do Guia de Métricas DPF / SISP 4.3 para o padrão contratual\n'
    '3. IFPUG CPM 4.3 como referência técnica secundária\n'
    '4. Interpretação própria (somente quando nenhuma das anteriores se aplica — justificar)',

    -- rule_critical_guidelines
    E'REGRAS CRÍTICAS:\n'
    '• Cada EF deve ser contado UMA ÚNICA VEZ, mesmo referenciado em múltiplas HUs\n'
    '• Consultas simples a dados já existentes NÃO geram novo EF se não há processamento adicional\n'
    '• Validações e mensagens de erro embutidas em uma transação principal NÃO são EFs separados\n'
    '• Relatórios e dashboards são EOs ou EQs, nunca ARQs\n'
    '• Integrações externas com sistema legado: verificar se já existe EIF no baseline antes de criar novo',

    -- rule_elementary_process
    E'PROCESSO ELEMENTAR E UNICIDADE:\n'
    'Um EF é atômico: representa a menor unidade de funcionalidade com valor para o usuário. '
    'Se duas HUs distintas implementam a mesma operação sobre o mesmo conjunto de dados, '
    'elas compartilham o mesmo EF — não duplique. '
    'Use o campo "precedent_ref" para registrar o baseline_item utilizado como âncora.',

    -- rule_granularity
    E'GRANULARIDADE:\n'
    '• TRN/EI: operação de entrada que mantém um ou mais ILFs\n'
    '• TRN/EO: operação de saída com lógica de processamento\n'
    '• TRN/EQ: consulta simples sem lógica adicional\n'
    '• ARQ/ILF: grupo lógico de dados mantidos pelo sistema\n'
    '• ARQ/EIF: grupo lógico de dados referenciados mas mantidos externamente\n'
    'Quando em dúvida entre TRN e ARQ, pergunte: o usuário ATIVA esta função ou o sistema a MANTÉM?',

    -- rule_precedence_override
    E'PRECEDÊNCIA DO HISTÓRICO:\n'
    'Se o baseline do projeto já homologou uma decisão de contagem para um tipo similar de EF, '
    'ESSA DECISÃO PREVALECE sobre qualquer interpretação teórica. '
    'Documente o precedente usado em "precedent_ref". '
    'Se discordar do precedente, registre em gray_zones mas NÃO altere a contagem.',

    -- rule_closure
    E'FECHAMENTO DO PROCESSO ELEMENTAR:\n'
    'Um processo elementar só está completo quando:\n'
    '1. O usuário iniciou a ação\n'
    '2. O sistema processou e manteve ou recuperou dados\n'
    '3. O sistema confirmou o resultado ao usuário\n'
    'Se qualquer um dos três não ocorre, o item pode ser NM ou parte de outro EF.',

    -- rule_contractual_consistency
    E'CONSISTÊNCIA CONTRATUAL:\n'
    'Todas as contagens deste modelo seguem o padrão PFS/DPF conforme contratado. '
    'Em caso de dúvida sobre classificação de fator de impacto, consulte a tabela apf_impact_factors '
    'deste modelo. Não invente fatores fora da lista configurada para o contrato.'

  )
  ON CONFLICT (model_id) DO UPDATE
    SET rule_mission                  = EXCLUDED.rule_mission,
        rule_fundamental_principle    = EXCLUDED.rule_fundamental_principle,
        rule_decision_hierarchy       = EXCLUDED.rule_decision_hierarchy,
        rule_critical_guidelines      = EXCLUDED.rule_critical_guidelines,
        rule_elementary_process       = EXCLUDED.rule_elementary_process,
        rule_granularity              = EXCLUDED.rule_granularity,
        rule_precedence_override      = EXCLUDED.rule_precedence_override,
        rule_closure                  = EXCLUDED.rule_closure,
        rule_contractual_consistency  = EXCLUDED.rule_contractual_consistency,
        updated_at                    = now();

  -- -------------------------------------------------------
  -- 6. Template de evidência (9 seções oficiais)
  -- -------------------------------------------------------
  INSERT INTO public.apf_output_templates (model_id, name, sections)
  VALUES (
    v_model_id,
    'Documento de Evidência de Contagem APF — PFS/DPF',
    '[
      {
        "id": "1",
        "title": "Dados do Atendimento",
        "fields": ["contrato", "projeto", "sprint_ref", "release_ref", "redmine_ref", "analista", "data_contagem"]
      },
      {
        "id": "2",
        "title": "Escopo da Contagem",
        "fields": ["objetivo", "tipo_contagem", "fronteira_aplicacao", "usuarios_externos"]
      },
      {
        "id": "3",
        "title": "Modelo APF Aplicado",
        "fields": ["padrao", "guia_metrica", "versao_baseline"]
      },
      {
        "id": "4",
        "title": "Resumo dos Elementos Funcionais",
        "fields": ["tabela_efs", "total_transacionais", "total_dados", "total_efs"]
      },
      {
        "id": "5",
        "title": "Detalhamento das Transações (TRN/EI/EO/EQ)",
        "fields": ["tabela_detalhada_transacionais"]
      },
      {
        "id": "6",
        "title": "Detalhamento dos Arquivos (ARQ/ILF/EIF)",
        "fields": ["tabela_detalhada_dados"]
      },
      {
        "id": "7",
        "title": "Apuração dos Pontos de Função",
        "fields": ["tabela_apuracao", "total_pf_bruto", "total_pf_fs"]
      },
      {
        "id": "8",
        "title": "Itens Não Mensuráveis",
        "fields": ["tabela_nm", "justificativas"]
      },
      {
        "id": "9",
        "title": "Zonas Cinzentas e Decisões de Interpretação",
        "fields": ["tabela_gray_zones", "decisoes_adotadas", "precedentes_consultados"]
      }
    ]'::jsonb
  )
  ON CONFLICT (model_id) DO UPDATE
    SET name       = EXCLUDED.name,
        sections   = EXCLUDED.sections,
        updated_at = now();

  RETURN v_model_id;
END;
$$;

COMMENT ON FUNCTION public.provision_apf_model_pfs_dpf(UUID, TEXT) IS
  'Provisiona um modelo APF PFS/DPF completo para um contrato: tipos de função, '
  '34 fatores de impacto, categorias, regras de prompt e template de evidência. Idempotente.';

-- ============================================================
-- BLOCO 2: RPC — get_apf_model_by_contract
-- Retorna o modelo APF completo de um contrato (para uso no frontend e na IA)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_apf_model_by_contract(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_model_id UUID;
  v_result   JSONB;
BEGIN
  SELECT id INTO v_model_id
  FROM public.apf_counting_models
  WHERE contract_id = p_contract_id AND is_active = true
  LIMIT 1;

  IF v_model_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Nenhum modelo APF ativo encontrado para este contrato.');
  END IF;

  SELECT jsonb_build_object(
    'model',          row_to_json(m.*),
    'function_types', (SELECT jsonb_agg(row_to_json(ft.*) ORDER BY ft.sort_order)
                       FROM public.apf_function_types ft
                       WHERE ft.model_id = v_model_id AND ft.is_active = true),
    'impact_factors', (SELECT jsonb_agg(row_to_json(f.*) ORDER BY f.sort_order)
                       FROM public.apf_impact_factors f
                       WHERE f.model_id = v_model_id AND f.is_active = true),
    'categories',     (SELECT jsonb_agg(row_to_json(c.*))
                       FROM public.apf_categories c
                       WHERE c.model_id = v_model_id AND c.is_active = true),
    'rules',          (SELECT row_to_json(r.*)
                       FROM public.apf_counting_rules r
                       WHERE r.model_id = v_model_id),
    'output_template',(SELECT row_to_json(t.*)
                       FROM public.apf_output_templates t
                       WHERE t.model_id = v_model_id)
  )
  INTO v_result
  FROM public.apf_counting_models m
  WHERE m.id = v_model_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_apf_model_by_contract(UUID) IS
  'Retorna o modelo APF completo de um contrato em JSON: tipos de função, fatores, '
  'categorias, regras de prompt e template de evidência.';

-- ============================================================
-- BLOCO 3: RPC — calculate_apf_item
-- Calcula pf_bruto e pf_fs para um item de contagem.
-- Usado pelo frontend e pela IA antes de inserir em apf_counting_items.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_apf_item(
  p_model_id       UUID,
  p_function_sigla TEXT,
  p_factor_sigla   TEXT
)
RETURNS TABLE (
  pf_bruto         NUMERIC,
  contribution_pct NUMERIC,
  pf_fs            NUMERIC,
  function_name    TEXT,
  factor_name      TEXT,
  action_on_baseline TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_weight         NUMERIC;
  v_contribution   NUMERIC;
  v_action         TEXT;
BEGIN
  SELECT ft.weight INTO v_weight
  FROM public.apf_function_types ft
  WHERE ft.model_id = p_model_id AND ft.sigla = p_function_sigla AND ft.is_active = true;

  IF v_weight IS NULL THEN
    RAISE EXCEPTION 'Tipo de função não encontrado: %', p_function_sigla;
  END IF;

  SELECT f.contribution_pct, f.action_on_baseline INTO v_contribution, v_action
  FROM public.apf_impact_factors f
  WHERE f.model_id = p_model_id AND f.sigla = p_factor_sigla AND f.is_active = true;

  IF v_contribution IS NULL THEN
    RAISE EXCEPTION 'Fator de impacto não encontrado: %', p_factor_sigla;
  END IF;

  RETURN QUERY
  SELECT
    v_weight                                                  AS pf_bruto,
    v_contribution                                            AS contribution_pct,
    ROUND(v_weight * (v_contribution / 100.0), 2)            AS pf_fs,
    (SELECT ft2.name FROM public.apf_function_types ft2
     WHERE ft2.model_id = p_model_id AND ft2.sigla = p_function_sigla) AS function_name,
    (SELECT f2.name  FROM public.apf_impact_factors f2
     WHERE f2.model_id = p_model_id AND f2.sigla = p_factor_sigla)     AS factor_name,
    v_action                                                  AS action_on_baseline;
END;
$$;

COMMENT ON FUNCTION public.calculate_apf_item(UUID, TEXT, TEXT) IS
  'Calcula pf_bruto e pf_fs para uma combinação de tipo de função + fator de impacto. '
  'Retorna também os nomes e a ação sobre o baseline (Incluir/Alterar, Remover, Não Impacta).';

-- ============================================================
-- BLOCO 4: RPC — recalculate_session_totals
-- Recalcula os totais de uma sessão de contagem a partir dos itens.
-- Deve ser chamado após qualquer insert/update/delete em apf_counting_items.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_session_totals(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.apf_counting_sessions s
  SET
    total_pf_bruto  = COALESCE((
      SELECT SUM(i.pf_bruto)
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id
        AND i.is_validated = true
    ), 0),
    total_pf_fs     = COALESCE((
      SELECT SUM(COALESCE(i.corrected_pf_fs, i.pf_fs))
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id
        AND i.is_validated = true
    ), 0),
    total_functions = COALESCE((
      SELECT COUNT(*)
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id
        AND i.is_validated = true
    ), 0),
    total_hus       = COALESCE((
      SELECT COUNT(DISTINCT i.hu_ref)
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id
        AND i.hu_ref IS NOT NULL
    ), 0),
    updated_at      = now()
  WHERE s.id = p_session_id;
END;
$$;

COMMENT ON FUNCTION public.recalculate_session_totals(UUID) IS
  'Recalcula total_pf_bruto, total_pf_fs, total_functions e total_hus de uma sessão APF '
  'com base nos itens validados. Usa corrected_pf_fs quando disponível.';

-- ============================================================
-- BLOCO 5: TRIGGER — recalcula totais automaticamente
-- Dispara recalculate_session_totals após insert/update/delete em apf_counting_items
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_recalculate_session_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_session_totals(OLD.session_id);
  ELSE
    PERFORM public.recalculate_session_totals(NEW.session_id);
  END IF;
  RETURN NULL;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_apf_items_recalc_totals
    AFTER INSERT OR UPDATE OR DELETE ON public.apf_counting_items
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_recalculate_session_totals();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- BLOCO 6: RPC — get_apf_session_summary
-- Retorna resumo completo de uma sessão para o documento de evidência
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_apf_session_summary(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'session',          row_to_json(s.*),
    'items_validated',  (
      SELECT jsonb_agg(row_to_json(i.*) ORDER BY i.sort_order, i.hu_ref)
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id AND i.is_validated = true
    ),
    'items_pending',    (
      SELECT jsonb_agg(row_to_json(i.*) ORDER BY i.sort_order, i.hu_ref)
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id AND i.is_validated = false
    ),
    'gray_zones',       (
      SELECT jsonb_agg(row_to_json(gz.*))
      FROM public.apf_gray_zones gz
      WHERE gz.session_id = p_session_id
    ),
    'by_function_type', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'function_sigla', i.function_sigla,
          'count',          COUNT(*),
          'pf_bruto_sum',   SUM(i.pf_bruto),
          'pf_fs_sum',      SUM(COALESCE(i.corrected_pf_fs, i.pf_fs))
        )
      )
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id AND i.is_validated = true
      GROUP BY i.function_sigla
    ),
    'by_factor',        (
      SELECT jsonb_agg(
        jsonb_build_object(
          'factor_sigla',   i.factor_sigla,
          'count',          COUNT(*),
          'pf_fs_sum',      SUM(COALESCE(i.corrected_pf_fs, i.pf_fs))
        )
      )
      FROM public.apf_counting_items i
      WHERE i.session_id = p_session_id AND i.is_validated = true
      GROUP BY i.factor_sigla
    )
  )
  INTO v_result
  FROM public.apf_counting_sessions s
  WHERE s.id = p_session_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_apf_session_summary(UUID) IS
  'Retorna resumo completo de uma sessão APF: itens validados, pendentes, zonas cinzentas '
  'e agrupamentos por tipo de função e fator de impacto. Base para geração do documento de evidência.';

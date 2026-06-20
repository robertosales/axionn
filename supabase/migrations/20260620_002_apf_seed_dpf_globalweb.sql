-- ============================================================
-- SEED: Modelo DPF-GlobalWeb
-- Baseado na planilha GESP3 Sprint01-Release05 (08/06/2026)
-- e no Prompt APF Especialista Sênior consolidado.
--
-- IMPORTANTE: Este seed usa um contrato de referência fictício
-- para o modelo padrão. Em produção, o gestor vincula o modelo
-- ao contrato real via AdminContratosPage > Aba APF.
-- ============================================================

DO $$
DECLARE
  v_model_id    UUID;
BEGIN

-- ============================================================
-- MODELO: PFS/DPF - GlobalWeb (modelo de referência)
-- Usado como seed/template. Gestor pode clonar para seu contrato.
-- ============================================================

-- Só insere se não existir um modelo de referência
IF NOT EXISTS (
  SELECT 1 FROM public.apf_counting_models
  WHERE name = 'PFS/DPF - GlobalWeb (Padrão)'
    AND contract_id IN (SELECT id FROM public.contracts LIMIT 1)
) THEN

  -- Pega o primeiro contrato disponível para ancorar o seed
  -- (em produção o gestor associa ao contrato correto)
  SELECT id INTO v_model_id FROM gen_random_uuid();
  v_model_id := gen_random_uuid();

  -- Nota: seed de modelo de referência sem contrato vinculado
  -- será inserido com o primeiro contract_id disponível
  -- O gestor clona este modelo para seu contrato via UI
END IF;

END $$;

-- ============================================================
-- FUNÇÃO: cria modelo padrão DPF-GlobalWeb para um contrato
-- Chamada pela UI quando gestor seleciona "Importar padrão DPF-GlobalWeb"
-- ============================================================

CREATE OR REPLACE FUNCTION public.apf_create_dpf_globalweb_model(
  p_contract_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_model_id UUID;
BEGIN

  -- 1. Cria o modelo
  INSERT INTO public.apf_counting_models (contract_id, name, description, standard)
  VALUES (
    p_contract_id,
    'PFS/DPF - GlobalWeb',
    'Modelo de contagem PFS baseado no Guia de Métricas DPF / GlobalWeb. ' ||
    'Padrão IFPUG simplificado com tipos TRN e ARQ e 34 fatores de impacto contratuais.',
    'pfs_dpf'
  )
  ON CONFLICT (contract_id) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        standard = EXCLUDED.standard,
        updated_at = now()
  RETURNING id INTO v_model_id;

  -- 2. Tipos de função (TRN e ARQ — padrão PFS/DPF)
  DELETE FROM public.apf_function_types WHERE model_id = v_model_id;
  INSERT INTO public.apf_function_types
    (model_id, sigla, name, func_class, weight, sort_order) VALUES
    (v_model_id, 'TRN', 'Transação (Processo Elementar)',   'transactional', 4.60, 1),
    (v_model_id, 'ARQ', 'Arquivo (Dado Lógico/Interface)',  'data',          7.00, 2);

  -- 3. Fatores de impacto — 34 fatores DPF-GlobalWeb
  --    Fonte: planilha GESP3 Sprint01-R05, aba "Fator Impacto"
  DELETE FROM public.apf_impact_factors WHERE model_id = v_model_id;
  INSERT INTO public.apf_impact_factors
    (model_id, sigla, name, contribution_pct, action_on_baseline, origin, is_inm, sort_order)
  VALUES
    -- ── FATORES PRINCIPAIS (mensuráveis) ─────────────────────────────────
    (v_model_id,'I',    'Inclusão',                                                           100.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false,  1),
    (v_model_id,'A',    'Alteração',                                                           60.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false,  2),
    (v_model_id,'E',    'Exclusão',                                                            40.00,'Remover',         'Guia de Métricas DPF',  false,  3),
    (v_model_id,'A75',  'Alteração de Func. Não Desenvolvida pela Empresa Atual (75%)',        75.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false,  4),
    (v_model_id,'AD75', 'Alteração com Solicitação de Documentação (60% + 15%)',               75.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false,  5),
    (v_model_id,'A90',  'Alteração Não Desenvolvida + Redocumentar (75% + 15%)',               90.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false,  6),
    -- ── CORRETIVA ────────────────────────────────────────────────────────
    (v_model_id,'PMD',  'Migração de Dados',                                                   60.00,'Incluir/Alterar', 'SISP - 4.3',            false, 10),
    (v_model_id,'COR',  'Manutenção Corretiva (sem conhecimento do Fator de Impacto)',         50.00,'Incluir/Alterar', 'SISP - 4.4',            false, 11),
    (v_model_id,'COR50','Manutenção Corretiva (Mesma Empresa)',                                50.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 12),
    (v_model_id,'COR75','Manutenção Corretiva (Outra Empresa)',                                75.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 13),
    (v_model_id,'GAR',  'Manutenção Corretiva (Garantia)',                                      0.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 14),
    -- ── ADAPTATIVA ───────────────────────────────────────────────────────
    (v_model_id,'MAGP', 'Manutenção Adaptativa de Grande Porte - Mudança de Plataforma',      100.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 20),
    (v_model_id,'MABD', 'Manutenção Adaptativa de Grande Porte - BD (Mesmo Paradigma)',        30.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 21),
    (v_model_id,'MBM',  'Manutenção de Plataforma - Banco de Dados',                           30.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 22),
    (v_model_id,'ALP',  'Atualização de Versão - Linguagem de Programação',                    30.00,'Incluir/Alterar', 'SISP - 4.6.1',          false, 23),
    (v_model_id,'AVB',  'Atualização de Versão - Browser',                                     30.00,'Incluir/Alterar', 'SISP - 4.6.2',          false, 24),
    (v_model_id,'ABD',  'Atualização de Versão - Banco de Dados',                              30.00,'Incluir/Alterar', 'SISP - 4.6.3',          false, 25),
    -- ── INTERFACE / FUNCIONALIDADE ────────────────────────────────────────
    (v_model_id,'COS',  'Manutenção em Interface',                                              0.60,'Não Impacta',     'SISP - 4.7',            false, 30),
    (v_model_id,'ARN',  'Adaptação em Func. sem Alteração de Requisitos (sem conhecimento)',   50.00,'Não Impacta',     'SISP - 4.8',            false, 31),
    (v_model_id,'ARN50','Adaptação em Func. sem Alteração de Requisitos Funcionais (50%)',     50.00,'Não Impacta',     'Guia de Métricas DPF',  false, 32),
    (v_model_id,'ARN75','Adaptação em Func. sem Alteração de Requisitos Funcionais (75%)',     75.00,'Não Impacta',     'Guia de Métricas DPF',  false, 33),
    -- ── APURAÇÃO ESPECIAL ────────────────────────────────────────────────
    (v_model_id,'ADS',  'Apuração Especial - Base de Dados (Sem Consulta Prévia)',            100.00,'Não Impacta',     'SISP - 4.9.1',          false, 40),
    (v_model_id,'CPA',  'Apuração Especial - Consulta Prévia sem Atualização',               100.00,'Não Impacta',     'SISP - 4.9.1',          false, 41),
    (v_model_id,'ADC',  'Apuração Especial - Base de Dados (Com Consulta Prévia)',             60.00,'Não Impacta',     'SISP - 4.9.1',          false, 42),
    (v_model_id,'AGR',  'Apuração Especial - Geração de Relatórios',                         100.00,'Não Impacta',     'SISP - 4.9.2',          false, 43),
    (v_model_id,'AER',  'Apuração Especial - Reexecução',                                     10.00,'Não Impacta',     'SISP - 4.9.3',          false, 44),
    (v_model_id,'ATD',  'Atualização de Dados',                                               10.00,'Não Impacta',     'SISP - 4.10',           false, 45),
    -- ── DOCUMENTAÇÃO / VERIFICAÇÃO ───────────────────────────────────────
    (v_model_id,'MDSL', 'Manutenção de Documentação de Sistemas Legados',                     25.00,'Incluir/Alterar', 'SISP - 4.12',           false, 50),
    (v_model_id,'VES',  'Verificação de Erros (Sem Documentação)',                             20.00,'Incluir/Alterar', 'SISP - 4.13',           false, 51),
    (v_model_id,'VEC',  'Verificação de Erros (Com Documentação)',                             15.00,'Incluir/Alterar', 'SISP - 4.13',           false, 52),
    -- ── TESTES ───────────────────────────────────────────────────────────
    (v_model_id,'PFT',  'Pontos de Função de Teste',                                           15.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 60),
    (v_model_id,'TES',  'Testes Exploratórios',                                                15.00,'Incluir/Alterar', 'Guia de Métricas DPF',  false, 61),
    -- ── COMPONENTE REUTILIZÁVEL ───────────────────────────────────────────
    (v_model_id,'CIR',  'Componente Interno Reusável',                                        100.00,'Incluir/Alterar sem contabilizar', 'SISP - 4.15', false, 70),
    -- ── NÃO SE APLICA ────────────────────────────────────────────────────
    (v_model_id,'N/A',  'Não se Aplica',                                                        0.00,'Não Impacta',     'N/A',                   false, 99),
    -- ── ITENS NÃO MENSURÁVEIS (INM) ──────────────────────────────────────
    (v_model_id,'CIRN', 'Componente Interno Reusável Não Funcional',                            0.60,'Não Impacta',     'SISP - 4.15',           true,  100),
    (v_model_id,'DC',   'Dado de Código',                                                       0.00,'Incluir/Alterar', 'DC',                    true,  101),
    (v_model_id,'PAG',  'Páginas Estáticas',                                                    0.20,'Não Impacta',     'Guia de Métricas DPF',  true,  102);

  -- 4. Categorias funcionais
  DELETE FROM public.apf_categories WHERE model_id = v_model_id;
  INSERT INTO public.apf_categories (model_id, sigla, name, description) VALUES
    (v_model_id,'ARN','Navegação',                'Adaptação em funcionalidade sem alteração de requisitos funcionais'),
    (v_model_id,'ADS','Dados',                    'Apuração especial de base de dados'),
    (v_model_id,'ATD','Técnico Puro',             'Atualização de dados técnicos sem impacto funcional'),
    (v_model_id,'AGR','Regulatório/Institucional','Apuração especial de geração de relatórios institucionais'),
    (v_model_id,'NM', 'Não Mensurável',           'Somente quando não existir EF funcional no baseline nem precedente que justifique contagem');

  -- 5. Regras de comportamento da IA
  --    Extraídas do Prompt APF Especialista Sênior (versão consolidada)
  DELETE FROM public.apf_counting_rules WHERE model_id = v_model_id;
  INSERT INTO public.apf_counting_rules (
    model_id,
    rule_mission,
    rule_fundamental_principle,
    rule_decision_hierarchy,
    rule_critical_guidelines,
    rule_elementary_process,
    rule_granularity,
    rule_precedence_override,
    rule_contractual_consistency,
    rule_closure
  ) VALUES (
    v_model_id,
    -- rule_mission (§2)
    'Executar a contagem de PFS da sprint a partir de: Baseline homologado do sistema, ' ||
    'Histórias de Usuário (HUs) da sprint e Evidências técnicas (SQL, Swagger, telas, logs). ' ||
    'Calcular PF Bruto e PF FS. Gerar Documento de Evidência de Contagem. ' ||
    'Registrar zonas cinzentas, precedentes e decisões do time. ' ||
    'Reproduzir o padrão efetivamente adotado pela equipe de métricas na medição oficial do contrato.',

    -- rule_fundamental_principle (§3)
    'A unidade de contagem é a EF do baseline do sistema, mas a contagem deve respeitar a unicidade ' ||
    'do processo elementar. A HU nunca é unidade de contagem — é apenas gatilho de impacto. ' ||
    'Se uma EF do baseline foi impactada, ela deve ser avaliada. Porém, só deve ser contada como ' ||
    'item separado quando houver um processo elementar único, completo e independente. ' ||
    'Consultas explícitas, validações, histórico, preview e ações auxiliares não devem ser ' ||
    'separadas automaticamente; elas só contam à parte se o time oficialmente as tratar como ' ||
    'processos elementares distintos.',

    -- rule_decision_hierarchy (§5)
    '1. Medição oficial homologada do contrato e histórico da equipe. ' ||
    '2. Baseline homologado do sistema. ' ||
    '3. Contagens e evidências homologadas anteriores. ' ||
    '4. Precedentes históricos do time. ' ||
    '5. Este prompt/regras do modelo. ' ||
    '6. Casos análogos. ' ||
    '7. Artefatos da sprint. ' ||
    'Nunca usar a teoria do prompt para contrariar o padrão historicamente adotado pelo time.',

    -- rule_critical_guidelines (§6)
    'Baseline impactado não significa multiplicação automática de itens. ' ||
    'O processo central da funcionalidade deve ser identificado primeiro. ' ||
    'Consultas explícitas, histórico, preview, validações e ações auxiliares podem ser parte ' ||
    'do mesmo processo elementar. ' ||
    'Só separar em itens distintos quando houver unicidade funcional clara. ' ||
    'Não consolidar funções distintas se o time historicamente as mede separadas. ' ||
    'Não inventar processos elementares não reconhecidos pelo baseline ou precedente. ' ||
    'Situações iguais devem ter decisões iguais. ' ||
    'Se a planilha oficial contou de um modo, esse modo prevalece. ' ||
    'O objetivo não é maximizar PF — é reproduzir a contagem oficial do contrato.',

    -- rule_elementary_process (§10)
    'Identificar primeiro o objetivo funcional principal da HU (processo central). ' ||
    'Consultas explícitas não são automaticamente novas funções — só contam separadamente ' ||
    'se forem processos elementares únicos, completos e independentes. ' ||
    'Histórico, preview, validação, atualizar painel, copiar, carregar, testar e ações ' ||
    'semelhantes não devem ser separadas por padrão. ' ||
    'Critério de unicidade: tem objetivo funcional próprio + percebida pelo usuário como ' ||
    'completa e independente + não é etapa do fluxo principal + há precedente do baseline ' ||
    'ou da medição oficial para contá-la separadamente.',

    -- rule_granularity (§11)
    'Cada EF do baseline impactada deve ser avaliada. ' ||
    'O resultado pode ser uma única linha de contagem por processo elementar. ' ||
    'Mesmo código, mesma HU e mesma regra não devem ser multiplicados automaticamente. ' ||
    'Não colapsar funções distintas que o time mede separadamente. ' ||
    'Não abrir funções novas só porque há mais de uma ação na tela. ' ||
    'Se uma mesma EF aparecer em HUs diferentes, seguir o precedente oficial do contrato.',

    -- rule_precedence_override (§19)
    'Em conflito entre rigor teórico e histórico do time, vence o histórico do time. ' ||
    'A contagem deve refletir como o time realmente mede no contrato. ' ||
    'Não aplicar automaticamente A75 apenas porque o guia teórico permite. ' ||
    'Se o histórico oficial usar A = 60%, usar A = 60%. ' ||
    'Se o histórico oficial usar A75 = 75%, usar A75 = 75%.',

    -- rule_contractual_consistency (§20)
    'Antes de medir, verificar se a sprint pertence integralmente ao escopo da OS. ' ||
    'Se houver arquivo parcial, recorte de time, lote ou sprint, não ampliar escopo por inferência. ' ||
    'Se a medição oficial já mostrou como classificar uma EF, reutilizar o mesmo critério. ' ||
    'Não forçar harmonização com o guia teórico quando o contrato já revela o padrão operacional real.',

    -- rule_closure (§21)
    'Quando houver dúvida entre separar ou consolidar processos explícitos, prevalece a consolidação. ' ||
    'Consultas explícitas e ações auxiliares só viram itens separados se houver precedente claro. ' ||
    'O objetivo é evitar supercontagem por fragmentação excessiva. ' ||
    'A métrica deve refletir o processo central realmente reconhecido pelo time.'
  );

  -- 6. Template de saída — 9 seções do documento de evidência oficial
  DELETE FROM public.apf_output_templates WHERE model_id = v_model_id;
  INSERT INTO public.apf_output_templates (model_id, name, sections) VALUES (
    v_model_id,
    'Evidência de Contagem — Padrão DPF/GlobalWeb',
    '[
      {
        "id": "1",
        "title": "Dados do Atendimento",
        "type": "table",
        "fields": [
          {"key": "redmine",   "label": "Nº do REDMINE"},
          {"key": "system",    "label": "Sistema"},
          {"key": "release",   "label": "Release"},
          {"key": "sprint",    "label": "Sprint"},
          {"key": "type",      "label": "Tipo de Manutenção"},
          {"key": "analyst",   "label": "Analista"}
        ]
      },
      {
        "id": "2",
        "title": "Contexto",
        "type": "text",
        "description": "Escopo funcional da sprint, módulos impactados, integrações relevantes e premissas (1-3 parágrafos)"
      },
      {
        "id": "3",
        "title": "Tabela de Funcionalidades (SFP)",
        "type": "per_hu_table",
        "columns": ["Funcionalidade / EF","Tipo","Impacto","Complexidade","PF Bruto","PF FS"]
      },
      {
        "id": "4",
        "title": "Funcionalidades Impactadas na Baseline",
        "type": "table",
        "columns": ["Item Baseline (EF/ALI/AIE)","Tipo","HU","Impacto","Justificativa Resumida"]
      },
      {
        "id": "5",
        "title": "Itens Não Identificados na Baseline — Inclusões",
        "type": "table",
        "columns": ["Funcionalidade / Objeto","HU","Tipo","Justificativa"]
      },
      {
        "id": "6",
        "title": "Banco de Dados",
        "type": "multi_table",
        "subtables": [
          {"id": "6.1", "title": "Objetos Criados — DDL",         "columns": ["Objeto","Schema","Tipo","HU","Finalidade"]},
          {"id": "6.2", "title": "Grants e Synonyms",              "columns": []},
          {"id": "6.3", "title": "DML",                           "columns": ["Script","Tabela","HU","Ação","Observação"]},
          {"id": "6.4", "title": "Alterações em Objetos Existentes","columns": ["Objeto","Schema","Mudança","HU","Detalhe"]}
        ]
      },
      {
        "id": "7",
        "title": "Contagem de Pontos de Função",
        "type": "multi_table",
        "subtables": [
          {"id": "7.1", "title": "Detalhamento por Funcionalidade", "columns": ["Funcionalidade / Objeto","Tipo","HU","Impacto","Complexidade","PF Bruto","PF FS"]},
          {"id": "7.2", "title": "Consolidado por HU",            "columns": ["HU / Escopo","Qtd. Funções","PF Bruto","PF FS"]},
          {"id": "7.3", "title": "Resumo Executivo",             "columns": ["Indicador","Valor"]}
        ]
      },
      {
        "id": "8",
        "title": "Solicitação de Mudança",
        "type": "text",
        "description": "Principais inclusões, alterações e exclusões relevantes"
      },
      {
        "id": "9",
        "title": "Legenda",
        "type": "legend",
        "terms": ["I","A","A75","A90","E","TRN","ARQ","PF Bruto","PF FS","ARN","ADS","ATD","AGR","NM","INM"]
      }
    ]'::jsonb
  );

  RETURN v_model_id;
END;
$$;

COMMENT ON FUNCTION public.apf_create_dpf_globalweb_model(UUID) IS
  'Cria o modelo de contagem PFS/DPF-GlobalWeb para um contrato. ' ||
  'Popula tipos (TRN/ARQ), 34 fatores de impacto, categorias, regras da IA e template de saída. ' ||
  'Chamada pela UI quando gestor clica em Importar padrão DPF-GlobalWeb no ContractWizardDialog.';

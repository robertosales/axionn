-- Axionn Commercial Module — Seed Data for Product Catalog & Plans
-- Fase 1: Popular catálogo, módulos, features, planos Core/Intelligence/Enterprise com versionamento
-- Executar exclusivamente pelo Lovable
begin;

-- ============================================================
-- 1. MÓDULOS DO PRODUTO
-- ============================================================

insert into public.product_modules (code, name, description, domain, display_order) values
-- Operação
('teams', 'Times', 'Gestão de times e estrutura organizacional', 'operation', 10),
('members', 'Membros', 'Gestão de membros e convites', 'operation', 20),
('activities', 'Atividades', 'Gestão de atividades e tarefas', 'operation', 30),
('calendar', 'Calendário', 'Calendário compartilhado e eventos', 'operation', 40),
('sprints', 'Sprints', 'Planejamento e acompanhamento de sprints', 'operation', 50),
('releases', 'Releases', 'Gestão de releases e versões', 'operation', 60),
('impediments', 'Impedimentos', 'Rastreamento e resolução de impedimentos', 'operation', 70),
('flows', 'Fluxos', 'Automação e fluxos de trabalho', 'operation', 80),
('projects', 'Projetos', 'Gestão de projetos e portfólio', 'operation', 90),
('organization', 'Organização', 'Configurações da organização', 'operation', 100),

-- Inteligência
('metrics', 'Métricas', 'Métricas operacionais e de negócio', 'intelligence', 110),
('reports', 'Relatórios', 'Relatórios e dashboards', 'intelligence', 120),
('history', 'Histórico', 'Histórico e auditoria de dados', 'intelligence', 130),
('evidences', 'Evidências', 'Evidências e compliance', 'intelligence', 140),
('productivity', 'Produtividade', 'Análise de produtividade', 'intelligence', 150),
('quality', 'Qualidade', 'Métricas de qualidade', 'intelligence', 160),
('ai_briefing', 'Briefing IA', 'Briefings gerados por IA', 'intelligence', 170),
('alerts', 'Alertas', 'Alertas inteligentes e notificações', 'intelligence', 180),
('trends', 'Tendências', 'Análise de tendências', 'intelligence', 190),

-- Estratégia e Governança
('okr', 'OKR', 'Objetivos e Key Results', 'governance', 200),
('initiatives', 'Iniciativas', 'Gestão de iniciativas estratégicas', 'governance', 210),
('administration', 'Administração', 'Administração da plataforma', 'governance', 220),
('contracts', 'Contratos', 'Gestão de contratos', 'governance', 230),
('rbac', 'RBAC', 'Controle de acesso baseado em roles', 'governance', 240),
('audit', 'Auditoria', 'Auditoria completa de ações', 'governance', 250),
('integrations', 'Integrações', 'Integrações corporativas', 'governance', 260),
('security', 'Segurança', 'Segurança e identidade', 'governance', 270),
('governance', 'Governança', 'Políticas de governança', 'governance', 280),

-- IA
('ai', 'Inteligência Artificial', 'Serviços de IA', 'intelligence', 290)

on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  domain = excluded.domain,
  display_order = excluded.display_order;

-- ============================================================
-- 2. FUNCIONALIDADES DO PRODUTO
-- ============================================================

with features(module_code, code, name, feature_type, usage_unit, description) as (
  values
  -- Organização (limites)
  ('organization', 'users.max', 'Limite de usuários ativos', 'limit', 'users', 'Máximo de usuários ativos na organização'),
  ('organization', 'teams.max', 'Limite de times', 'limit', 'teams', 'Máximo de times na organização'),
  ('organization', 'projects.max', 'Limite de projetos', 'limit', 'projects', 'Máximo de projetos simultâneos'),
  ('organization', 'contracts.max', 'Limite de contratos', 'limit', 'contracts', 'Máximo de contratos ativos'),
  ('organization', 'integrations.max', 'Limite de integrações', 'limit', 'integrations', 'Máximo de integrações ativas'),
  ('organization', 'storage.gb', 'Armazenamento (GB)', 'limit', 'gb', 'Armazenamento total em GB'),

  -- Times & Membros
  ('teams', 'teams.view', 'Visualizar times', 'capability', null, 'Ver lista de times e membros'),
  ('teams', 'teams.create', 'Criar times', 'capability', null, 'Criar novos times'),
  ('members', 'members.invite', 'Convidar membros', 'capability', null, 'Convidar novos membros para a organização'),

  -- Atividades
  ('activities', 'activities.view', 'Visualizar atividades', 'capability', null, 'Ver atividades e tarefas'),
  ('activities', 'activities.create', 'Criar atividades', 'capability', null, 'Criar novas atividades'),
  ('activities', 'activities.edit', 'Editar atividades', 'capability', null, 'Editar atividades existentes'),

  -- Calendário
  ('calendar', 'calendar.view', 'Visualizar calendário', 'capability', null, 'Ver calendário compartilhado'),
  ('calendar', 'calendar.edit', 'Editar calendário', 'capability', null, 'Gerenciar eventos do calendário'),

  -- Sprints
  ('sprints', 'sprints.view', 'Visualizar sprints', 'capability', null, 'Ver sprints ativas e histórico'),
  ('sprints', 'sprints.manage', 'Gerenciar sprints', 'capability', null, 'Criar, editar e encerrar sprints'),

  -- Releases
  ('releases', 'releases.view', 'Visualizar releases', 'capability', null, 'Ver releases e versões'),
  ('releases', 'releases.manage', 'Gerenciar releases', 'capability', null, 'Criar e gerenciar releases'),

  -- Impedimentos
  ('impediments', 'impediments.view', 'Visualizar impedimentos', 'capability', null, 'Ver impedimentos abertos'),
  ('impediments', 'impediments.manage', 'Gerenciar impedimentos', 'capability', null, 'Criar, atualizar e resolver impedimentos'),

  -- Fluxos
  ('flows', 'flows.view', 'Visualizar fluxos', 'capability', null, 'Ver fluxos de trabalho'),
  ('flows', 'flows.manage', 'Gerenciar fluxos', 'capability', null, 'Criar e editar fluxos de automação'),

  -- Projetos
  ('projects', 'projects.view', 'Visualizar projetos', 'capability', null, 'Ver projetos e portfólio'),
  ('projects', 'projects.create', 'Criar projetos', 'capability', null, 'Criar novos projetos'),
  ('projects', 'projects.edit', 'Editar projetos', 'capability', null, 'Editar projetos existentes'),

  -- Métricas
  ('metrics', 'metrics.basic', 'Métricas básicas', 'capability', null, 'Métricas essenciais de operação'),
  ('metrics', 'metrics.advanced', 'Métricas avançadas', 'capability', null, 'Métricas avançadas e preditivas'),

  -- Relatórios
  ('reports', 'reports.basic', 'Relatórios básicos', 'capability', null, 'Relatórios operacionais essenciais'),
  ('reports', 'reports.advanced', 'Relatórios avançados', 'capability', null, 'Relatórios gerenciais e estratégicos'),
  ('reports', 'reports.export_csv', 'Exportar CSV', 'capability', null, 'Exportar relatórios em CSV'),
  ('reports', 'reports.export_pdf', 'Exportar PDF', 'capability', null, 'Exportar relatórios em PDF'),
  ('reports', 'reports.evidence', 'Evidências em relatórios', 'capability', null, 'Incluir evidências nos relatórios'),
  ('reports', 'reports.schedule', 'Agendar relatórios', 'capability', null, 'Agendar envio automático de relatórios'),
  ('reports', 'reports.history_extended', 'Histórico estendido', 'capability', null, 'Acesso a histórico estendido de relatórios'),

  -- Histórico
  ('history', 'history.basic', 'Histórico básico', 'capability', null, 'Histórico de 3-6 meses'),
  ('history', 'history.extended', 'Histórico ampliado', 'capability', null, 'Histórico de até 24 meses'),
  ('history', 'history.unlimited', 'Histórico ilimitado', 'capability', null, 'Histórico sem limite de retenção'),

  -- Evidências
  ('evidences', 'evidences.view', 'Visualizar evidências', 'capability', null, 'Ver evidências anexadas'),
  ('evidences', 'evidences.manage', 'Gerenciar evidências', 'capability', null, 'Anexar e gerenciar evidências'),

  -- Produtividade
  ('productivity', 'productivity.view', 'Visualizar produtividade', 'capability', null, 'Ver métricas de produtividade'),
  ('productivity', 'productivity.advanced', 'Produtividade avançada', 'capability', null, 'Análise profunda de produtividade'),

  -- Qualidade
  ('quality', 'quality.view', 'Visualizar qualidade', 'capability', null, 'Ver métricas de qualidade'),
  ('quality', 'quality.advanced', 'Qualidade avançada', 'capability', null, 'Análise avançada de qualidade'),

  -- Briefing IA
  ('ai_briefing', 'ai.briefing.enabled', 'Briefing por IA', 'capability', null, 'Geração automática de briefings por IA'),
  ('ai_briefing', 'ai.briefing.sprint_summary', 'Resumo de sprint', 'capability', null, 'Resumo automático de sprint por IA'),
  ('ai_briefing', 'ai.briefing.risk_analysis', 'Análise de riscos', 'capability', null, 'Identificação de riscos por IA'),
  ('ai_briefing', 'ai.briefing.metric_explanation', 'Explicação de métricas', 'capability', null, 'Explicação automática de métricas'),
  ('ai_briefing', 'ai.briefing.recommendations', 'Recomendações operacionais', 'capability', null, 'Recomendações de IA para operações'),

  -- Alertas
  ('alerts', 'alerts.view', 'Visualizar alertas', 'capability', null, 'Ver alertas inteligentes'),
  ('alerts', 'alerts.manage', 'Gerenciar alertas', 'capability', null, 'Configurar regras de alertas'),

  -- Tendências
  ('trends', 'trends.view', 'Visualizar tendências', 'capability', null, 'Ver análises de tendências'),
  ('trends', 'trends.advanced', 'Tendências avançadas', 'capability', null, 'Previsibilidade e tendências preditivas'),

  -- OKR
  ('okr', 'okr.view', 'Visualizar OKRs', 'capability', null, 'Ver objetivos e key results'),
  ('okr', 'okr.create', 'Criar OKRs', 'capability', null, 'Criar objetivos e key results'),
  ('okr', 'okr.edit', 'Editar OKRs', 'capability', null, 'Editar objetivos e key results existentes'),
  ('okr', 'okr.archive', 'Arquivar OKRs', 'capability', null, 'Arquivar objetivos concluídos'),
  ('okr', 'okr.check_in', 'Check-in de KRs', 'capability', null, 'Atualizar progresso de key results'),
  ('okr', 'okr.initiatives', 'Iniciativas vinculadas', 'capability', null, 'Criar e gerir iniciativas ligadas a KRs'),
  ('okr', 'okr.automatic_metrics', 'Medições automáticas', 'capability', null, 'Progresso automático via métricas operacionais'),
  ('okr', 'okr.history', 'Histórico e snapshots', 'capability', null, 'Histórico de progresso e snapshots'),
  ('okr', 'okr.export', 'Exportar OKRs', 'capability', null, 'Exportar OKRs em CSV/PDF'),
  ('okr', 'okr.ai_recommendations', 'Recomendações de IA', 'capability', null, 'Sugestões de IA para OKRs'),

  -- Iniciativas
  ('initiatives', 'initiatives.view', 'Visualizar iniciativas', 'capability', null, 'Ver iniciativas estratégicas'),
  ('initiatives', 'initiatives.manage', 'Gerenciar iniciativas', 'capability', null, 'Criar, editar e acompanhar iniciativas'),

  -- Administração
  ('administration', 'administration.basic', 'Admin básica', 'capability', null, 'Administração básica da organização'),
  ('administration', 'administration.advanced', 'Admin avançada', 'capability', null, 'Administração avançada com multi-org'),

  -- Contratos
  ('contracts', 'contracts.view', 'Visualizar contratos', 'capability', null, 'Ver contratos da organização'),
  ('contracts', 'contracts.manage', 'Gerenciar contratos', 'capability', null, 'Criar e gerenciar contratos'),

  -- RBAC
  ('rbac', 'rbac.basic', 'RBAC básico', 'capability', null, 'Permissões básicas por role'),
  ('rbac', 'rbac.granular', 'RBAC granular', 'capability', null, 'Permissões granulares por recurso'),

  -- Auditoria
  ('audit', 'audit.access', 'Acesso à auditoria', 'capability', null, 'Ver logs de auditoria'),
  ('audit', 'audit.full', 'Auditoria completa', 'capability', null, 'Auditoria completa com retenção configurável'),

  -- Integrações
  ('integrations', 'integrations.basic', 'Integrações básicas', 'capability', null, 'Até 1 integração básica'),
  ('integrations', 'integrations.gitlab', 'GitLab', 'capability', null, 'Integração com GitLab'),
  ('integrations', 'integrations.github', 'GitHub', 'capability', null, 'Integração com GitHub'),
  ('integrations', 'integrations.jira', 'Jira', 'capability', null, 'Integração com Jira'),
  ('integrations', 'integrations.custom', 'Integrações customizadas', 'capability', null, 'APIs e webhooks customizados'),

  -- Segurança
  ('security', 'security.sso', 'SSO', 'capability', null, 'Single Sign-On corporativo'),
  ('security', 'security.keycloak', 'Keycloak', 'capability', null, 'Integração com Keycloak'),
  ('security', 'security.session_policies', 'Políticas de sessão', 'capability', null, 'Políticas avançadas de sessão'),
  ('security', 'security.auth_logs', 'Logs de autenticação', 'capability', null, 'Logs detalhados de autenticação'),

  -- Governança
  ('governance', 'governance.data_retention', 'Retenção de dados', 'capability', null, 'Políticas configuráveis de retenção'),
  ('governance', 'governance.compliance', 'Conformidade', 'capability', null, 'Evidências de conformidade e compliance'),

  -- IA
  ('ai', 'ai.calls.monthly', 'Chamadas de IA/mês', 'limit', 'calls', 'Cota mensal de chamadas de IA'),
  ('ai', 'ai.tokens.monthly', 'Tokens de IA/mês', 'limit', 'tokens', 'Cota mensal de tokens de IA'),
  ('ai', 'ai.briefing.enabled', 'Briefing por IA', 'capability', null, 'Geração de briefing por IA'),
  ('ai', 'ai.sprint_summary', 'Resumo de sprint', 'capability', null, 'Resumo automático de sprint'),
  ('ai', 'ai.risk_analysis', 'Análise de riscos', 'capability', null, 'Identificação de riscos por IA'),
  ('ai', 'ai.metric_explanation', 'Explicação de métricas', 'capability', null, 'Explicação automática de métricas'),
  ('ai', 'ai.recommendations', 'Recomendações de IA', 'capability', null, 'Recomendações operacionais'),
  ('ai', 'ai.custom_provider', 'Provedor de IA próprio', 'capability', null, 'Configurar provedor de IA customizado'),
  ('ai', 'ai.audit_logs', 'Auditoria de IA', 'capability', null, 'Logs de auditoria de uso de IA')
)
insert into public.product_features (module_id, code, name, feature_type, usage_unit, description)
select m.id, f.code, f.name, f.feature_type, f.usage_unit, f.description
from features f
join public.product_modules m on m.code = f.module_code
where m.status = 'active'
on conflict (code) do update set
  module_id = excluded.module_id,
  name = excluded.name,
  feature_type = excluded.feature_type,
  usage_unit = excluded.usage_unit,
  description = excluded.description;

-- ============================================================
-- 3. PLANOS COMERCIAIS (Core, Intelligence, Enterprise)
-- ============================================================

insert into public.saas_plans (code, name, description, audience, status, display_order, is_public, requires_sales_contact, trial_allowed, trial_days_default, currency, billing_interval, base_price, per_user_price, metadata) values
  ('core', 'Axionn Core', 'Organizar a operação e permitir acompanhamento essencial dos times.', 'Pequenas equipes e startups', 'active', 1, true, false, true, 30, 'BRL', 'monthly', 0, 0, jsonb_build_object('tier', 'core')),
  ('intelligence', 'Axionn Intelligence', 'Transformar dados operacionais em inteligência, previsibilidade e acompanhamento gerencial.', 'Equipes em crescimento e gestores', 'active', 2, true, false, true, 14, 'BRL', 'monthly', 0, 0, jsonb_build_object('tier', 'intelligence')),
  ('enterprise', 'Axionn Enterprise', 'Escala, governança, segurança, auditoria e integrações corporativas.', 'Grandes organizações', 'active', 3, false, true, true, null, 'BRL', 'yearly', 0, 0, jsonb_build_object('tier', 'enterprise'))
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  audience = excluded.audience,
  status = excluded.status,
  display_order = excluded.display_order,
  is_public = excluded.is_public,
  requires_sales_contact = excluded.requires_sales_contact,
  trial_allowed = excluded.trial_allowed,
  trial_days_default = excluded.trial_days_default,
  currency = excluded.currency,
  billing_interval = excluded.billing_interval,
  base_price = excluded.base_price,
  per_user_price = excluded.per_user_price,
  metadata = excluded.metadata;

-- ============================================================
-- 4. VERSÕES DOS PLANOS (v1)
-- ============================================================

insert into public.saas_plan_versions (plan_id, version, status, valid_from, trial_allowed, trial_days, change_reason, metadata)
select p.id, 1, 'active', p.created_at, p.trial_allowed, p.trial_days_default, 'Versão inicial do catálogo comercial', jsonb_build_object('tier', p.code)
from public.saas_plans p
where p.code in ('core','intelligence','enterprise')
on conflict (plan_id, version) do nothing;

-- ============================================================
-- 5. MATRIZ DE FEATURES POR PLANO/VERSÃO
-- ============================================================

-- Helper: mapear feature_code -> plan_version_id + config
with pv as (
  select pv.id as plan_version_id, p.code as plan_code
  from public.saas_plan_versions pv
  join public.saas_plans p on p.id = pv.plan_id
  where pv.version = 1 and pv.status = 'active'
),
feat_map(plan_code, feature_code, access_level, enabled, limit_value, reset_period, enforcement_mode, configuration) as (
  values
  -- CORE
  ('core', 'users.max', 'full', true, 15, 'monthly', 'hard', '{}'),
  ('core', 'teams.max', 'full', true, 3, 'monthly', 'hard', '{}'),
  ('core', 'projects.max', 'full', true, 5, 'monthly', 'hard', '{}'),
  ('core', 'contracts.max', 'full', true, 3, 'monthly', 'hard', '{}'),
  ('core', 'integrations.max', 'full', true, 1, 'monthly', 'hard', '{}'),
  ('core', 'storage.gb', 'full', true, 5, 'monthly', 'hard', '{}'),

  ('core', 'teams.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'teams.create', 'full', true, null, null, 'notify', '{}'),
  ('core', 'members.invite', 'full', true, null, null, 'notify', '{}'),

  ('core', 'activities.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'activities.create', 'full', true, null, null, 'notify', '{}'),
  ('core', 'activities.edit', 'full', true, null, null, 'notify', '{}'),

  ('core', 'calendar.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'calendar.edit', 'full', true, null, null, 'notify', '{}'),

  ('core', 'sprints.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'sprints.manage', 'full', true, null, null, 'notify', '{}'),

  ('core', 'releases.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'releases.manage', 'full', true, null, null, 'notify', '{}'),

  ('core', 'impediments.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'impediments.manage', 'full', true, null, null, 'notify', '{}'),

  ('core', 'flows.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'flows.manage', 'basic', true, null, null, 'notify', '{}'),

  ('core', 'projects.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'projects.create', 'full', true, null, null, 'notify', '{}'),
  ('core', 'projects.edit', 'full', true, null, null, 'notify', '{}'),

  ('core', 'metrics.basic', 'full', true, null, null, 'notify', '{}'),
  ('core', 'metrics.advanced', 'none', false, null, null, 'notify', '{}'),

  ('core', 'reports.basic', 'full', true, null, null, 'notify', '{}'),
  ('core', 'reports.advanced', 'none', false, null, null, 'notify', '{}'),
  ('core', 'reports.export_csv', 'full', true, null, null, 'notify', '{}'),
  ('core', 'reports.export_pdf', 'none', false, null, null, 'notify', '{}'),
  ('core', 'reports.evidence', 'basic', true, null, null, 'notify', '{}'),
  ('core', 'reports.schedule', 'none', false, null, null, 'notify', '{}'),
  ('core', 'reports.history_extended', 'none', false, null, null, 'notify', '{}'),

  ('core', 'history.basic', 'full', true, 180, 'monthly', 'hard', '{"retention_days": 180}'),
  ('core', 'history.extended', 'none', false, null, null, 'notify', '{}'),
  ('core', 'history.unlimited', 'none', false, null, null, 'notify', '{}'),

  ('core', 'evidences.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'evidences.manage', 'basic', true, 3, 'monthly', 'hard', '{"max_per_item": 3}'),

  ('core', 'productivity.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'productivity.advanced', 'none', false, null, null, 'notify', '{}'),

  ('core', 'quality.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'quality.advanced', 'none', false, null, null, 'notify', '{}'),

  ('core', 'ai.briefing.enabled', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.briefing.sprint_summary', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.briefing.risk_analysis', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.briefing.metric_explanation', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.briefing.recommendations', 'none', false, null, null, 'notify', '{}'),

  ('core', 'alerts.view', 'basic', true, null, null, 'notify', '{}'),
  ('core', 'alerts.manage', 'none', false, null, null, 'notify', '{}'),

  ('core', 'trends.view', 'none', false, null, null, 'notify', '{}'),
  ('core', 'trends.advanced', 'none', false, null, null, 'notify', '{}'),

  ('core', 'okr.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'okr.create', 'full', true, null, null, 'notify', '{}'),
  ('core', 'okr.edit', 'full', true, null, null, 'notify', '{}'),
  ('core', 'okr.archive', 'full', true, null, null, 'notify', '{}'),
  ('core', 'okr.check_in', 'full', true, null, null, 'notify', '{}'),
  ('core', 'okr.initiatives', 'basic', true, 3, 'monthly', 'hard', '{"max_per_kr": 3}'),
  ('core', 'okr.automatic_metrics', 'none', false, null, null, 'notify', '{}'),
  ('core', 'okr.history', 'basic', true, 90, 'monthly', 'hard', '{"retention_days": 90}'),
  ('core', 'okr.export', 'none', false, null, null, 'notify', '{}'),
  ('core', 'okr.ai_recommendations', 'none', false, null, null, 'notify', '{}'),

  ('core', 'initiatives.view', 'basic', true, null, null, 'notify', '{}'),
  ('core', 'initiatives.manage', 'none', false, null, null, 'notify', '{}'),

  ('core', 'administration.basic', 'full', true, null, null, 'notify', '{}'),
  ('core', 'administration.advanced', 'none', false, null, null, 'notify', '{}'),

  ('core', 'contracts.view', 'full', true, null, null, 'notify', '{}'),
  ('core', 'contracts.manage', 'basic', true, null, null, 'notify', '{}'),

  ('core', 'rbac.basic', 'full', true, null, null, 'notify', '{}'),
  ('core', 'rbac.granular', 'none', false, null, null, 'notify', '{}'),

  ('core', 'audit.access', 'none', false, null, null, 'notify', '{}'),
  ('core', 'audit.full', 'none', false, null, null, 'notify', '{}'),

  ('core', 'integrations.basic', 'full', true, 1, 'monthly', 'hard', '{}'),
  ('core', 'integrations.gitlab', 'none', false, null, null, 'notify', '{}'),
  ('core', 'integrations.github', 'none', false, null, null, 'notify', '{}'),
  ('core', 'integrations.jira', 'none', false, null, null, 'notify', '{}'),
  ('core', 'integrations.custom', 'none', false, null, null, 'notify', '{}'),

  ('core', 'security.sso', 'none', false, null, null, 'notify', '{}'),
  ('core', 'security.keycloak', 'none', false, null, null, 'notify', '{}'),
  ('core', 'security.session_policies', 'none', false, null, null, 'notify', '{}'),
  ('core', 'security.auth_logs', 'none', false, null, null, 'notify', '{}'),

  ('core', 'governance.data_retention', 'none', false, null, null, 'notify', '{}'),
  ('core', 'governance.compliance', 'none', false, null, null, 'notify', '{}'),

  ('core', 'ai.calls.monthly', 'full', true, 50, 'monthly', 'hard', '{}'),
  ('core', 'ai.tokens.monthly', 'full', true, 50000, 'monthly', 'hard', '{}'),
  ('core', 'ai.sprint_summary', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.risk_analysis', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.metric_explanation', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.recommendations', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.custom_provider', 'none', false, null, null, 'notify', '{}'),
  ('core', 'ai.audit_logs', 'none', false, null, null, 'notify', '{}'),

  -- INTELLIGENCE
  ('intelligence', 'users.max', 'full', true, 50, 'monthly', 'hard', '{}'),
  ('intelligence', 'teams.max', 'full', true, 10, 'monthly', 'hard', '{}'),
  ('intelligence', 'projects.max', 'full', true, 30, 'monthly', 'hard', '{}'),
  ('intelligence', 'contracts.max', 'full', true, 25, 'monthly', 'hard', '{}'),
  ('intelligence', 'integrations.max', 'full', true, 5, 'monthly', 'hard', '{}'),
  ('intelligence', 'storage.gb', 'full', true, 50, 'monthly', 'hard', '{}'),

  ('intelligence', 'teams.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'teams.create', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'members.invite', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'activities.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'activities.create', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'activities.edit', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'calendar.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'calendar.edit', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'sprints.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'sprints.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'releases.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'releases.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'impediments.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'impediments.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'flows.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'flows.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'projects.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'projects.create', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'projects.edit', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'metrics.basic', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'metrics.advanced', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'reports.basic', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'reports.advanced', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'reports.export_csv', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'reports.export_pdf', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'reports.evidence', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'reports.schedule', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'reports.history_extended', 'basic', true, 10, 'monthly', 'hard', '{"monthly_exports": 10}'),

  ('intelligence', 'history.basic', 'full', true, 365, 'monthly', 'hard', '{"retention_days": 365}'),
  ('intelligence', 'history.extended', 'full', true, 730, 'monthly', 'hard', '{"retention_days": 730}'),
  ('intelligence', 'history.unlimited', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'evidences.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'evidences.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'productivity.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'productivity.advanced', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'quality.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'quality.advanced', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'ai.briefing.enabled', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.briefing.sprint_summary', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.briefing.risk_analysis', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.briefing.metric_explanation', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.briefing.recommendations', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'alerts.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'alerts.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'trends.view', 'basic', true, null, null, 'notify', '{}'),
  ('intelligence', 'trends.advanced', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'okr.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'okr.create', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'okr.edit', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'okr.archive', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'okr.check_in', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'okr.initiatives', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'okr.automatic_metrics', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'okr.history', 'full', true, 365, 'monthly', 'hard', '{"retention_days": 365}'),
  ('intelligence', 'okr.export', 'basic', true, 10, 'monthly', 'hard', '{"monthly_exports": 10, "formats": ["csv"]}'),
  ('intelligence', 'okr.ai_recommendations', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'initiatives.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'initiatives.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'administration.basic', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'administration.advanced', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'contracts.view', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'contracts.manage', 'full', true, null, null, 'notify', '{}'),

  ('intelligence', 'rbac.basic', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'rbac.granular', 'basic', true, null, null, 'notify', '{}'),

  ('intelligence', 'audit.access', 'none', false, null, null, 'notify', '{}'),
  ('intelligence', 'audit.full', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'integrations.basic', 'full', true, 5, 'monthly', 'hard', '{}'),
  ('intelligence', 'integrations.gitlab', 'basic', true, null, null, 'notify', '{}'),
  ('intelligence', 'integrations.github', 'basic', true, null, null, 'notify', '{}'),
  ('intelligence', 'integrations.jira', 'basic', true, null, null, 'notify', '{}'),
  ('intelligence', 'integrations.custom', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'security.sso', 'none', false, null, null, 'notify', '{}'),
  ('intelligence', 'security.keycloak', 'none', false, null, null, 'notify', '{}'),
  ('intelligence', 'security.session_policies', 'none', false, null, null, 'notify', '{}'),
  ('intelligence', 'security.auth_logs', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'governance.data_retention', 'none', false, null, null, 'notify', '{}'),
  ('intelligence', 'governance.compliance', 'none', false, null, null, 'notify', '{}'),

  ('intelligence', 'ai.calls.monthly', 'full', true, 1000, 'monthly', 'hard', '{}'),
  ('intelligence', 'ai.tokens.monthly', 'full', true, 500000, 'monthly', 'hard', '{}'),
  ('intelligence', 'ai.sprint_summary', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.risk_analysis', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.metric_explanation', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.recommendations', 'full', true, null, null, 'notify', '{}'),
  ('intelligence', 'ai.custom_provider', 'none', false, null, null, 'notify', '{}'),
  ('intelligence', 'ai.audit_logs', 'none', false, null, null, 'notify', '{}'),

  -- ENTERPRISE (tudo ilimitado/full)
  ('enterprise', 'users.max', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'teams.max', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'projects.max', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'contracts.max', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'integrations.max', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'storage.gb', 'full', true, null, 'monthly', 'hard', '{}'),

  ('enterprise', 'teams.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'teams.create', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'members.invite', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'activities.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'activities.create', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'activities.edit', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'calendar.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'calendar.edit', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'sprints.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'sprints.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'releases.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'releases.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'impediments.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'impediments.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'flows.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'flows.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'projects.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'projects.create', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'projects.edit', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'metrics.basic', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'metrics.advanced', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'reports.basic', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'reports.advanced', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'reports.export_csv', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'reports.export_pdf', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'reports.evidence', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'reports.schedule', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'reports.history_extended', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'history.basic', 'full', true, null, 'monthly', 'hard', '{"retention_days": null}'),
  ('enterprise', 'history.extended', 'full', true, null, 'monthly', 'hard', '{"retention_days": null}'),
  ('enterprise', 'history.unlimited', 'full', true, null, 'monthly', 'hard', '{"retention_days": null}'),

  ('enterprise', 'evidences.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'evidences.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'productivity.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'productivity.advanced', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'quality.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'quality.advanced', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'ai.briefing.enabled', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.briefing.sprint_summary', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.briefing.risk_analysis', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.briefing.metric_explanation', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.briefing.recommendations', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'alerts.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'alerts.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'trends.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'trends.advanced', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'okr.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'okr.create', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'okr.edit', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'okr.archive', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'okr.check_in', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'okr.initiatives', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'okr.automatic_metrics', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'okr.history', 'full', true, null, 'monthly', 'hard', '{"retention_days": null}'),
  ('enterprise', 'okr.export', 'full', true, null, 'monthly', 'hard', '{"formats": ["csv", "pdf", "xlsx"]}'),
  ('enterprise', 'okr.ai_recommendations', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'initiatives.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'initiatives.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'administration.basic', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'administration.advanced', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'contracts.view', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'contracts.manage', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'rbac.basic', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'rbac.granular', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'audit.access', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'audit.full', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'integrations.basic', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'integrations.gitlab', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'integrations.github', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'integrations.jira', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'integrations.custom', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'security.sso', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'security.keycloak', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'security.session_policies', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'security.auth_logs', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'governance.data_retention', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'governance.compliance', 'full', true, null, null, 'notify', '{}'),

  ('enterprise', 'ai.calls.monthly', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'ai.tokens.monthly', 'full', true, null, 'monthly', 'hard', '{}'),
  ('enterprise', 'ai.sprint_summary', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.risk_analysis', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.metric_explanation', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.recommendations', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.custom_provider', 'full', true, null, null, 'notify', '{}'),
  ('enterprise', 'ai.audit_logs', 'full', true, null, null, 'notify', '{}')
)
insert into public.saas_plan_version_features (plan_version_id, feature_id, access_level, enabled, limit_value, reset_period, enforcement_mode, configuration)
select pv.plan_version_id, pf.id, fm.access_level, fm.enabled, fm.limit_value, fm.reset_period, fm.enforcement_mode, fm.configuration
from feat_map fm
join pv on pv.plan_code = fm.plan_code
join public.product_features pf on pf.code = fm.feature_code
on conflict (plan_version_id, feature_id) do update set
  access_level = excluded.access_level,
  enabled = excluded.enabled,
  limit_value = excluded.limit_value,
  reset_period = excluded.reset_period,
  enforcement_mode = excluded.enforcement_mode,
  configuration = excluded.configuration;

-- ============================================================
-- 6. LEGADO ENTITLEMENTS (compatibilidade)
-- ============================================================

-- popular saas_plan_entitlements para compatibilidade com código legado
with ent_seed(plan_code, feature_key, enabled, limit_value) as (
  values
    ('core', 'users.max', true, 15::bigint),
    ('core', 'projects.max', true, 5::bigint),
    ('core', 'contracts.max', true, 3::bigint),
    ('core', 'apf.countings.monthly', true, 20::bigint),
    ('core', 'ai.calls.monthly', true, 50::bigint),
    ('core', 'apf.ai_generation', false, null::bigint),
    ('core', 'reports.advanced', false, null::bigint),
    ('core', 'audit.access', false, null::bigint),

    ('intelligence', 'users.max', true, 50::bigint),
    ('intelligence', 'projects.max', true, 30::bigint),
    ('intelligence', 'contracts.max', true, 25::bigint),
    ('intelligence', 'apf.countings.monthly', true, 500::bigint),
    ('intelligence', 'ai.calls.monthly', true, 1000::bigint),
    ('intelligence', 'apf.ai_generation', true, null::bigint),
    ('intelligence', 'reports.advanced', true, null::bigint),
    ('intelligence', 'audit.access', false, null::bigint),

    ('enterprise', 'users.max', true, null::bigint),
    ('enterprise', 'projects.max', true, null::bigint),
    ('enterprise', 'contracts.max', true, null::bigint),
    ('enterprise', 'apf.countings.monthly', true, null::bigint),
    ('enterprise', 'ai.calls.monthly', true, null::bigint),
    ('enterprise', 'apf.ai_generation', true, null::bigint),
    ('enterprise', 'reports.advanced', true, null::bigint),
    ('enterprise', 'audit.access', true, null::bigint)
)
insert into public.saas_plan_entitlements (plan_id, feature_key, enabled, limit_value)
select p.id, e.feature_key, e.enabled, e.limit_value
from ent_seed e
join public.saas_plans p on p.code = e.plan_code
on conflict (plan_id, feature_key) do nothing;

-- ============================================================
-- 7. BACKFILL ASSINATURAS EXISTENTES
-- ============================================================

update public.organization_subscriptions s
set plan_version_id = pv.id
from public.saas_plan_versions pv
join public.saas_plans p on p.id = pv.plan_id
where s.plan_version_id is null
  and pv.version = 1
  and pv.status = 'active'
  and p.code = case s.plan_id::text
    when 'starter' then 'core'
    when 'pro' then 'intelligence'
    when 'enterprise' then 'enterprise'
    else 'core' end;

commit;
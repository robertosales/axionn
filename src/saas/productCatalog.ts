export type ProductDomain = "operation" | "intelligence" | "governance";
export type FeatureType = "capability" | "limit" | "service";

export interface ProductModuleDefinition {
  code: string;
  name: string;
  domain: ProductDomain;
}

export interface ProductFeatureDefinition {
  code: string;
  moduleCode: string;
  name: string;
  type: FeatureType;
  usageUnit?: string;
}

export const PRODUCT_MODULES: readonly ProductModuleDefinition[] = [
  // Operação
  { code: "teams", name: "Times", domain: "operation" },
  { code: "members", name: "Membros", domain: "operation" },
  { code: "activities", name: "Atividades", domain: "operation" },
  { code: "calendar", name: "Calendário", domain: "operation" },
  { code: "sprints", name: "Sprints", domain: "operation" },
  { code: "releases", name: "Releases", domain: "operation" },
  { code: "impediments", name: "Impedimentos", domain: "operation" },
  { code: "flows", name: "Fluxos", domain: "operation" },
  { code: "projects", name: "Projetos", domain: "operation" },
  { code: "organization", name: "Organização", domain: "operation" },
  // Inteligência
  { code: "metrics", name: "Métricas", domain: "intelligence" },
  { code: "reports", name: "Relatórios", domain: "intelligence" },
  { code: "history", name: "Histórico", domain: "intelligence" },
  { code: "evidence", name: "Evidências", domain: "intelligence" },
  { code: "productivity", name: "Produtividade", domain: "intelligence" },
  { code: "quality", name: "Qualidade", domain: "intelligence" },
  { code: "ai_briefing", name: "Briefing IA", domain: "intelligence" },
  { code: "alerts", name: "Alertas", domain: "intelligence" },
  { code: "trends", name: "Tendências", domain: "intelligence" },
  // Governança
  { code: "okr", name: "OKR", domain: "governance" },
  { code: "initiatives", name: "Iniciativas", domain: "governance" },
  { code: "administration", name: "Administração", domain: "governance" },
  { code: "contracts", name: "Contratos", domain: "governance" },
  { code: "rbac", name: "RBAC", domain: "governance" },
  { code: "audit", name: "Auditoria", domain: "governance" },
  { code: "integrations", name: "Integrações", domain: "governance" },
  { code: "security", name: "Segurança", domain: "governance" },
  { code: "governance", name: "Governança", domain: "governance" },
] as const;

export const PRODUCT_FEATURES: readonly ProductFeatureDefinition[] = [
  // --- OPERAÇÃO ---
  // Times
  { code: "teams.view", moduleCode: "teams", name: "Visualizar times", type: "capability" },
  { code: "teams.create", moduleCode: "teams", name: "Criar times", type: "capability" },
  { code: "teams.edit", moduleCode: "teams", name: "Editar times", type: "capability" },
  { code: "teams.archive", moduleCode: "teams", name: "Arquivar times", type: "capability" },
  { code: "teams.max", moduleCode: "teams", name: "Limite de times", type: "limit", usageUnit: "teams" },

  // Membros
  { code: "members.view", moduleCode: "members", name: "Visualizar membros", type: "capability" },
  { code: "members.invite", moduleCode: "members", name: "Convidar membros", type: "capability" },
  { code: "members.edit", moduleCode: "members", name: "Editar membros", type: "capability" },
  { code: "members.remove", moduleCode: "members", name: "Remover membros", type: "capability" },
  { code: "users.max", moduleCode: "organization", name: "Limite de usuários", type: "limit", usageUnit: "users" },

  // Atividades
  { code: "activities.view", moduleCode: "activities", name: "Visualizar atividades", type: "capability" },
  { code: "activities.create", moduleCode: "activities", name: "Criar atividades", type: "capability" },
  { code: "activities.edit", moduleCode: "activities", name: "Editar atividades", type: "capability" },
  { code: "activities.delete", moduleCode: "activities", name: "Excluir atividades", type: "capability" },

  // Calendário
  { code: "calendar.view", moduleCode: "calendar", name: "Visualizar calendário", type: "capability" },
  { code: "calendar.edit", moduleCode: "calendar", name: "Editar calendário", type: "capability" },

  // Sprints
  { code: "sprints.view", moduleCode: "sprints", name: "Visualizar sprints", type: "capability" },
  { code: "sprints.create", moduleCode: "sprints", name: "Criar sprints", type: "capability" },
  { code: "sprints.edit", moduleCode: "sprints", name: "Editar sprints", type: "capability" },
  { code: "sprints.delete", moduleCode: "sprints", name: "Excluir sprints", type: "capability" },
  { code: "sprints.planning", moduleCode: "sprints", name: "Planning poker", type: "capability" },
  { code: "sprints.retrospective", moduleCode: "sprints", name: "Retrospectiva", type: "capability" },

  // Releases
  { code: "releases.view", moduleCode: "releases", name: "Visualizar releases", type: "capability" },
  { code: "releases.create", moduleCode: "releases", name: "Criar releases", type: "capability" },
  { code: "releases.edit", moduleCode: "releases", name: "Editar releases", type: "capability" },

  // Impedimentos
  { code: "impediments.view", moduleCode: "impediments", name: "Visualizar impedimentos", type: "capability" },
  { code: "impediments.create", moduleCode: "impediments", name: "Criar impedimentos", type: "capability" },
  { code: "impediments.edit", moduleCode: "impediments", name: "Editar impedimentos", type: "capability" },
  { code: "impediments.resolve", moduleCode: "impediments", name: "Resolver impedimentos", type: "capability" },

  // Fluxos
  { code: "flows.view", moduleCode: "flows", name: "Visualizar fluxos", type: "capability" },
  { code: "flows.edit", moduleCode: "flows", name: "Editar fluxos", type: "capability" },

  // Projetos
  { code: "projects.view", moduleCode: "projects", name: "Visualizar projetos", type: "capability" },
  { code: "projects.create", moduleCode: "projects", name: "Criar projetos", type: "capability" },
  { code: "projects.edit", moduleCode: "projects", name: "Editar projetos", type: "capability" },
  { code: "projects.archive", moduleCode: "projects", name: "Arquivar projetos", type: "capability" },
  { code: "projects.max", moduleCode: "projects", name: "Limite de projetos", type: "limit", usageUnit: "projects" },

  // Organização
  { code: "organization.settings", moduleCode: "organization", name: "Configurações da organização", type: "capability" },
  { code: "organization.branding", moduleCode: "organization", name: "Branding da organização", type: "capability" },
  { code: "contracts.max", moduleCode: "organization", name: "Limite de contratos", type: "limit", usageUnit: "contracts" },

  // --- INTELIGÊNCIA ---
  // Métricas
  { code: "metrics.basic", moduleCode: "metrics", name: "Métricas básicas", type: "capability" },
  { code: "metrics.advanced", moduleCode: "metrics", name: "Métricas avançadas", type: "capability" },
  { code: "metrics.velocity", moduleCode: "metrics", name: "Velocidade", type: "capability" },
  { code: "metrics.burndown", moduleCode: "metrics", name: "Burndown", type: "capability" },
  { code: "metrics.throughput", moduleCode: "metrics", name: "Throughput", type: "capability" },
  { code: "metrics.cycle_time", moduleCode: "metrics", name: "Cycle time", type: "capability" },
  { code: "metrics.commitment", moduleCode: "metrics", name: "Commitment", type: "capability" },
  { code: "metrics.carryover", moduleCode: "metrics", name: "Carryover", type: "capability" },

  // Relatórios
  { code: "reports.basic", moduleCode: "reports", name: "Relatórios básicos", type: "capability" },
  { code: "reports.advanced", moduleCode: "reports", name: "Relatórios avançados", type: "capability" },
  { code: "reports.export_csv", moduleCode: "reports", name: "Exportar CSV", type: "capability" },
  { code: "reports.export_pdf", moduleCode: "reports", name: "Exportar PDF", type: "capability" },
  { code: "reports.evidence", moduleCode: "reports", name: "Relatório de evidências", type: "capability" },
  { code: "reports.schedule", moduleCode: "reports", name: "Agendar relatórios", type: "capability" },

  // Histórico
  { code: "history.view", moduleCode: "history", name: "Visualizar histórico", type: "capability" },
  { code: "history.retention_days", moduleCode: "history", name: "Retenção de histórico (dias)", type: "limit", usageUnit: "days" },

  // Evidências
  { code: "evidence.view", moduleCode: "evidence", name: "Visualizar evidências", type: "capability" },
  { code: "evidence.create", moduleCode: "evidence", name: "Criar evidências", type: "capability" },

  // Produtividade
  { code: "productivity.view", moduleCode: "productivity", name: "Visualizar produtividade", type: "capability" },
  { code: "productivity.individual", moduleCode: "productivity", name: "Visão individual", type: "capability" },
  { code: "productivity.team", moduleCode: "productivity", name: "Visão do time", type: "capability" },

  // Qualidade
  { code: "quality.basic", moduleCode: "quality", name: "Indicadores básicos de qualidade", type: "capability" },
  { code: "quality.advanced", moduleCode: "quality", name: "Indicadores avançados de qualidade", type: "capability" },

  // IA - Briefing
  { code: "ai.briefing.enabled", moduleCode: "ai_briefing", name: "Briefing por IA", type: "capability" },
  { code: "ai.briefing.sprint_summary", moduleCode: "ai_briefing", name: "Resumo de sprint", type: "capability" },
  { code: "ai.briefing.risk_analysis", moduleCode: "ai_briefing", name: "Análise de riscos", type: "capability" },
  { code: "ai.briefing.metric_explanation", moduleCode: "ai_briefing", name: "Explicação de métricas", type: "capability" },
  { code: "ai.briefing.recommendations", moduleCode: "ai_briefing", name: "Recomendações operacionais", type: "capability" },
  { code: "ai.briefing.max_input_chars", moduleCode: "ai_briefing", name: "Limite de caracteres de entrada", type: "limit", usageUnit: "chars" },

  // Alertas
  { code: "alerts.view", moduleCode: "alerts", name: "Visualizar alertas", type: "capability" },
  { code: "alerts.configure", moduleCode: "alerts", name: "Configurar alertas", type: "capability" },

  // Tendências
  { code: "trends.view", moduleCode: "trends", name: "Visualizar tendências", type: "capability" },

  // --- GOVERNANÇA ---
  // OKR
  { code: "okr.view", moduleCode: "okr", name: "Visualizar OKRs", type: "capability" },
  { code: "okr.create", moduleCode: "okr", name: "Criar objetivos e KRs", type: "capability" },
  { code: "okr.edit", moduleCode: "okr", name: "Editar objetivos e KRs", type: "capability" },
  { code: "okr.archive", moduleCode: "okr", name: "Arquivar objetivos", type: "capability" },
  { code: "okr.check_in", moduleCode: "okr", name: "Check-in de Key Results", type: "capability" },
  { code: "okr.initiatives", moduleCode: "okr", name: "Iniciativas vinculadas a KRs", type: "capability" },
  { code: "okr.automatic_metrics", moduleCode: "okr", name: "Medições automáticas de OKR", type: "capability" },
  { code: "okr.history", moduleCode: "okr", name: "Histórico e snapshots de OKR", type: "capability" },
  { code: "okr.export", moduleCode: "okr", name: "Exportação de OKRs (CSV/PDF)", type: "capability" },
  { code: "okr.ai_recommendations", moduleCode: "okr", name: "Recomendações de IA para OKRs", type: "capability" },

  // Iniciativas
  { code: "initiatives.view", moduleCode: "initiatives", name: "Visualizar iniciativas", type: "capability" },
  { code: "initiatives.create", moduleCode: "initiatives", name: "Criar iniciativas", type: "capability" },
  { code: "initiatives.edit", moduleCode: "initiatives", name: "Editar iniciativas", type: "capability" },
  { code: "initiatives.link_kr", moduleCode: "initiatives", name: "Vincular iniciativas a KRs", type: "capability" },

  // Administração
  { code: "admin.organizations", moduleCode: "administration", name: "Gerenciar organizações", type: "capability" },
  { code: "admin.users", moduleCode: "administration", name: "Gerenciar usuários", type: "capability" },
  { code: "admin.plans", moduleCode: "administration", name: "Gerenciar planos", type: "capability" },
  { code: "admin.subscriptions", moduleCode: "administration", name: "Gerenciar assinaturas", type: "capability" },
  { code: "admin.contracts", moduleCode: "administration", name: "Gerenciar contratos", type: "capability" },
  { code: "admin.trials", moduleCode: "administration", name: "Gerenciar trials", type: "capability" },
  { code: "admin.overrides", moduleCode: "administration", name: "Gerenciar overrides", type: "capability" },
  { code: "admin.usage", moduleCode: "administration", name: "Ver uso e consumo", type: "capability" },
  { code: "admin.billing", moduleCode: "administration", name: "Gerenciar cobrança", type: "capability" },

  // Contratos
  { code: "contracts.view", moduleCode: "contracts", name: "Visualizar contratos", type: "capability" },
  { code: "contracts.create", moduleCode: "contracts", name: "Criar contratos", type: "capability" },
  { code: "contracts.edit", moduleCode: "contracts", name: "Editar contratos", type: "capability" },
  { code: "contracts.sla", moduleCode: "contracts", name: "Gerenciar SLAs", type: "capability" },

  // RBAC
  { code: "rbac.view", moduleCode: "rbac", name: "Visualizar RBAC", type: "capability" },
  { code: "rbac.edit", moduleCode: "rbac", name: "Editar RBAC", type: "capability" },
  { code: "rbac.granular", moduleCode: "rbac", name: "RBAC granular", type: "capability" },

  // Auditoria
  { code: "audit.access", moduleCode: "audit", name: "Acesso à auditoria", type: "capability" },
  { code: "audit.full", moduleCode: "audit", name: "Auditoria completa", type: "capability" },
  { code: "audit.export", moduleCode: "audit", name: "Exportar auditoria", type: "capability" },

  // Integrações
  { code: "integrations.view", moduleCode: "integrations", name: "Visualizar integrações", type: "capability" },
  { code: "integrations.create", moduleCode: "integrations", name: "Criar integrações", type: "capability" },
  { code: "integrations.gitlab", moduleCode: "integrations", name: "Integração GitLab", type: "capability" },
  { code: "integrations.github", moduleCode: "integrations", name: "Integração GitHub", type: "capability" },
  { code: "integrations.jira", moduleCode: "integrations", name: "Integração Jira", type: "capability" },
  { code: "integrations.slack", moduleCode: "integrations", name: "Integração Slack", type: "capability" },
  { code: "integrations.max", moduleCode: "integrations", name: "Limite de integrações", type: "limit", usageUnit: "integrations" },

  // Segurança
  { code: "security.sso", moduleCode: "security", name: "SSO", type: "capability" },
  { code: "security.keycloak", moduleCode: "security", name: "Integração Keycloak", type: "capability" },
  { code: "security.session_policies", moduleCode: "security", name: "Políticas de sessão", type: "capability" },
  { code: "security.auth_logs", moduleCode: "security", name: "Logs de autenticação", type: "capability" },

  // Governança
  { code: "governance.data_retention", moduleCode: "governance", name: "Políticas de retenção", type: "capability" },
  { code: "governance.compliance", moduleCode: "governance", name: "Conformidade", type: "capability" },

  // IA - Geral
  { code: "ai.calls.monthly", moduleCode: "ai", name: "Chamadas de IA mensais", type: "limit", usageUnit: "calls" },
  { code: "ai.tokens.monthly", moduleCode: "ai", name: "Tokens de IA mensais", type: "limit", usageUnit: "tokens" },
  { code: "ai.custom_provider", moduleCode: "ai", name: "Provedor de IA próprio", type: "capability" },
] as const;

export const COMMERCIAL_PLAN_ALIASES = { starter: "core", pro: "intelligence", enterprise: "enterprise" } as const;

export function getProductFeature(code: string) {
  return PRODUCT_FEATURES.find((feature) => feature.code === code) ?? null;
}

export function commercialPlanCode(legacyCode: string) {
  return COMMERCIAL_PLAN_ALIASES[legacyCode as keyof typeof COMMERCIAL_PLAN_ALIASES] ?? legacyCode;
}

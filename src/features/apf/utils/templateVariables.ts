/**
 * templateVariables
 * -----------------
 * Dicionário de variáveis dinâmicas suportadas nos prompts de template.
 * Formato: {{NOME_DA_VARIAVEL}}
 *
 * Em runtime, resolveTemplateVariables() substitui cada ocorrência
 * com o valor real antes de enviar o prompt para a IA.
 */

export interface TemplateVariable {
  /** Identificador usado no prompt: {{VARIAVEL}} */
  key: string;
  /** Label amigável exibida no editor */
  label: string;
  /** Descrição do que será injetado */
  description: string;
  /** Categoria para agrupamento visual */
  category: "sprint" | "time" | "data" | "ia";
  /** Exemplo de valor resolvido */
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // ── Sprint ────────────────────────────────────────────────────────────
  {
    key: "SPRINT_NAME",
    label: "Nome da Sprint",
    description: "Nome da sprint selecionada na aba (ex: Sprint 42)",
    category: "sprint",
    example: "Sprint 42",
  },
  {
    key: "SPRINT_START_DATE",
    label: "Início da Sprint",
    description: "Data de início da sprint no formato dd/mm/aaaa",
    category: "sprint",
    example: "01/06/2026",
  },
  {
    key: "SPRINT_END_DATE",
    label: "Fim da Sprint",
    description: "Data de encerramento da sprint no formato dd/mm/aaaa",
    category: "sprint",
    example: "15/06/2026",
  },
  {
    key: "SPRINT_HU_COUNT",
    label: "Qtd. HUs da Sprint",
    description: "Número total de Histórias de Usuário na sprint",
    category: "sprint",
    example: "23",
  },
  {
    key: "SPRINT_TOTAL_PF",
    label: "Total PF da Sprint",
    description: "Soma de todos os Pontos de Função validados na sprint",
    category: "sprint",
    example: "187.5",
  },
  {
    key: "SPRINT_TOTAL_SP",
    label: "Total Story Points",
    description: "Soma dos story points de todas as HUs da sprint",
    category: "sprint",
    example: "92",
  },

  // ── Time ─────────────────────────────────────────────────────────────
  {
    key: "TEAM_NAME",
    label: "Nome do Time",
    description: "Nome do time cadastrado no Axionn",
    category: "time",
    example: "Squad Payments",
  },
  {
    key: "USER_NAME",
    label: "Nome do Usuário",
    description: "Nome do usuário que está gerando o documento",
    category: "time",
    example: "Roberto Sales",
  },

  // ── Data/Hora ──────────────────────────────────────────────────────────
  {
    key: "TODAY",
    label: "Data de Hoje",
    description: "Data atual no formato dd/mm/aaaa no momento da geração",
    category: "data",
    example: new Date().toLocaleDateString("pt-BR"),
  },
  {
    key: "NOW",
    label: "Data e Hora Atual",
    description: "Data e hora completa no momento da geração",
    category: "data",
    example: new Date().toLocaleString("pt-BR"),
  },
  {
    key: "YEAR",
    label: "Ano Atual",
    description: "Ano de 4 dígitos",
    category: "data",
    example: String(new Date().getFullYear()),
  },

  // ── IA ────────────────────────────────────────────────────────────────
  {
    key: "AI_PROVIDER_NAME",
    label: "Nome do Provedor IA",
    description: "Nome do provedor de IA selecionado no Hub",
    category: "ia",
    example: "Lovable AI (Gratuita)",
  },
];

/** Mapa rápido key → variável */
export const VARIABLE_MAP = new Map(
  TEMPLATE_VARIABLES.map((v) => [v.key, v])
);

/** Categorias com labels */
export const VARIABLE_CATEGORIES = {
  sprint: "Sprint",
  time:   "Time & Usuário",
  data:   "Data & Hora",
  ia:     "IA",
} as const;

/**
 * Substitui todas as variáveis {{KEY}} no prompt com valores reais.
 * Variáveis sem valor resolvido são mantidas com placeholder vazio.
 */
export function resolveTemplateVariables(
  prompt: string,
  ctx: Partial<Record<string, string>>
): string {
  return prompt.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    return ctx[key] ?? match; // mantém {{KEY}} se não resolvido
  });
}

/**
 * Retorna lista de chaves de variáveis presentes no prompt.
 */
export function extractVariables(prompt: string): string[] {
  const matches = prompt.matchAll(/\{\{([A-Z_]+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

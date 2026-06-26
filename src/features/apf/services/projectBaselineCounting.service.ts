import type {
  AnalysisCandidateType,
  AnalysisRecommendation,
  ProjectBaselineProcessCandidate,
  ProjectBaselineProcessItem,
} from "../types/apfRuntime.types";
import {
  buildSelectedBaselineItems,
  selectBaselineItemsForReview,
  selectDeterministicBaselineItems,
} from "./projectBaselineItemSelection.service";

export const PROCESS_ANALYSIS_PROMPT_VERSION = "apf-process-separation-v1";
export const PROCESS_ANALYSIS_SCHEMA_VERSION = "apf-process-analysis-schema-v1";

const TRANSACTIONAL_TYPES = new Set(["EE", "CE", "SE", "TRN"]);
const LOGICAL_TYPES = new Set(["ALI", "AIE"]);

export interface LogicalFileCandidate {
  id: string;
  item_ref: string;
  description: string;
  function_sigla: "ALI" | "AIE";
  match_score?: number;
}

export interface ValidationPrecedentCandidate {
  hu_title: string | null;
  validated_functional_type: string | null;
  validated_factor_sigla: string | null;
  correction_notes: string | null;
  ai_reasoning: string | null;
  baseline_item_id: string | null;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function truncate(value: unknown, limit: number) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit)}…`;
}

function primaryScope(storyText: string) {
  return normalize(
    storyText
      .split(/(?:critérios? de aceite|criterios? de aceite)/i)[0]
      .slice(0, 2200),
  );
}

function wordTokens(value: unknown) {
  const stop = new Set([
    "para", "com", "dos", "das", "uma", "por", "que", "como", "deve",
    "sistema", "funcionalidade", "processo", "processos", "usuario", "modulo",
    "projeto", "historia", "objetivo", "descricao", "criterios", "aceite",
  ]);
  return new Set(
    normalize(value).split(/\s+/).filter((token) => token.length > 3 && !stop.has(token)),
  );
}

function lexicalScore(left: unknown, right: unknown) {
  const leftTokens = wordTokens(left);
  const rightTokens = wordTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, 8);
}

function balancedJsonObjects(value: string) {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function parseJsonCandidate(value: string) {
  return JSON.parse(value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim());
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function enumValue(value: unknown, allowed: string[], fallback: string) {
  const key = normalize(value).replace(/ /g, "_");
  return allowed.includes(key) ? key : fallback;
}

function candidateItems(candidates: ProjectBaselineProcessCandidate[]) {
  return candidates.flatMap((candidate) => candidate.items ?? []);
}

function bestItemMatch(value: unknown, items: ProjectBaselineProcessItem[]) {
  const exact = items.find((item) => normalize(item.description) === normalize(value));
  if (exact) return { item: exact, score: 1 };
  const ranked = items
    .map((item) => ({
      item,
      score: Math.max(Number(item.match_score ?? 0), lexicalScore(value, item.description)),
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 0.22 ? ranked[0] : null;
}

export function inferImpactFactor(
  storyText: string,
  availableFactors: string[],
): string {
  const scope = primaryScope(storyText);
  const has = (sigla: string) => availableFactors.includes(sigla);
  const explicitExclusion = /\b(excluir|exclusao|remover|retirar|desativar)\b.{0,80}\b(funcionalidade|processo|campo|opcao|acao|tela|servico|arquivo)\b/.test(scope)
    || /\b(exclusao|desativacao)\s+(da|do|de)\b/.test(scope);
  if (explicitExclusion && has("E")) return "E";
  if (/\b(migrar|migracao|carga de dados)\b/.test(scope) && has("PMD")) return "PMD";
  if (/\b(corrigir|correcao|erro|bug|defeito)\b/.test(scope)) {
    if (has("COR50")) return "COR50";
    if (has("COR")) return "COR";
  }
  if (has("A")) return "A";
  if (has("I")) return "I";
  return availableFactors[0] ?? "N/A";
}

export function hasDeterministicProcessMatch(
  candidates: ProjectBaselineProcessCandidate[],
): boolean {
  const first = candidates[0];
  const second = candidates[1];
  if (!first) return false;
  return Number(first.match_score) >= 0.32
    && (!second || Number(first.match_score) - Number(second.match_score) >= 0.07);
}

export function buildStructuredProcessAnalysisPrompt(args: {
  storyId: string;
  storyText: string;
  candidates: ProjectBaselineProcessCandidate[];
  logicalFiles: LogicalFileCandidate[];
  precedents: ValidationPrecedentCandidate[];
}) {
  const baseline = args.candidates.slice(0, 6).map((candidate) => ({
    process_ref: candidate.process_ref,
    process_name: truncate(candidate.process_name, 160),
    match_score: Number(candidate.match_score),
    items: candidate.items
      .filter((item) => TRANSACTIONAL_TYPES.has(item.function_sigla))
      .slice(0, 5)
      .map((item) => ({
        baseline_item_id: item.id,
        item_baseline: truncate(item.description, 200),
        item_ref: item.item_ref,
        tipo: item.function_sigla,
        complexidade: item.complexity,
        pf_bruto: Number(item.pf_bruto),
        aderencia_lexical: Number(item.match_score ?? 0),
      })),
  }));
  const logical = args.logicalFiles.slice(0, 12).map((item) => ({
    baseline_item_id: item.id,
    item_baseline: truncate(item.description, 180),
    item_ref: item.item_ref,
    tipo: item.function_sigla,
  }));
  const precedents = args.precedents.slice(0, 6).map((item) => ({
    hu: truncate(item.hu_title, 160),
    tipo_validado: item.validated_functional_type,
    fator_validado: item.validated_factor_sigla,
    decisao: truncate(item.correction_notes ?? item.ai_reasoning, 240),
    baseline_item_id: item.baseline_item_id,
  }));

  return [
    "ATENÇÃO: esta execução NÃO gera documento. A única saída permitida é um objeto JSON válido.",
    "Você é Especialista Sênior em APF/PFS no padrão operacional DPF/GlobalWeb.",
    "MISSÃO: identificar o processo central, separar processos elementares candidatos, relacionar precedentes da baseline e informar ALI/AIE apenas como arquivos referenciados.",
    "REGRAS: a HU é somente gatilho; EE/CE/SE/TRN podem ser processos; ALI/AIE nunca são processos; não invente item; ações auxiliares são absorvidas; consultas só se separam com autonomia e precedente; ambiguidade exige requer_validacao_humana.",
    "Não existe limite artificial de dois processos. Separe apenas os sustentados por autonomia, completude, resultado funcional e precedente.",
    "Use nomes exatos e baseline_item_id fornecidos na baseline_analogas e arquivos_logicos_referenciados.",
    "SCHEMA OBRIGATÓRIO:",
    JSON.stringify({
      hu_id: args.storyId,
      hu_resumo: "string",
      status_analise: "ok|requer_validacao_humana",
      motivo_status: "string",
      processo_central: { nome: "string", justificativa: "string" },
      quantidade_processos_identificados: 0,
      processos: [{
        id_temporario: "P1",
        nome_processo: "string",
        acao_negocio: "string",
        objeto_negocio: "string",
        tipo_funcional_candidato: "EE|CE|SE|TRN|indefinido",
        deve_contar_como_processo_elementar: true,
        justificativa_separacao: "string",
        resultado_funcional_entregue: "string",
        independente_dos_demais: true,
        precedente_baseline_encontrado: true,
        baseline_analogas: [{
          baseline_item_id: "uuid fornecido",
          item_baseline: "nome exato fornecido",
          tipo: "EE|CE|SE|TRN|ALI|AIE|indefinido",
          aderencia: "alta|media|baixa",
          motivo_aderencia: "string",
        }],
        arquivos_logicos_referenciados: [{
          baseline_item_id: "uuid ou null",
          nome: "nome exato",
          tipo: "ALI|AIE|desconhecido",
          papel_no_processo: "mantido|consultado|ambos|desconhecido",
        }],
        sinais_para_o_contador_existente: {
          campos_percebidos: ["string"],
          arquivos_referenciados_percebidos: ["string"],
          observacoes: "string",
        },
        duvidas_ou_riscos: ["string"],
        recomendacao_para_contador_existente: "enviar|nao_enviar|enviar_com_validacao",
      }],
      itens_absorvidos_no_processo_central: [{ descricao: "string", motivo_absorcao: "string" }],
      itens_nao_contaveis_como_processo: [{ descricao: "string", motivo: "string" }],
      pendencias_de_detalhamento: ["string"],
    }),
    `HU:${truncate(args.storyText, 3800)}`,
    `BASELINE_TRANSACIONAL:${JSON.stringify(baseline)}`,
    `ARQUIVOS_LOGICOS:${JSON.stringify(logical)}`,
    `PRECEDENTES:${JSON.stringify(precedents)}`,
    "Retorne somente JSON, sem markdown, títulos ou explicações externas.",
  ].join("\n");
}

export function parseStructuredProcessAnalysis(raw: string): any {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]);
  const candidates = [clean, ...fenced, ...balancedJsonObjects(clean)];
  for (const candidate of candidates) {
    try {
      const parsed = parseJsonCandidate(candidate);
      const result = parsed?.analysis ?? parsed?.result ?? parsed;
      if (result && typeof result === "object" && Array.isArray(result.processos)) return result;
    } catch {
      // Tenta o próximo objeto balanceado.
    }
  }
  throw new Error("A IA não retornou a análise estruturada no schema esperado.");
}

export function normalizeStructuredProcessAnalysis(raw: any, args: {
  storyId: string;
  storyCode: string;
  storyTitle: string;
  candidates: ProjectBaselineProcessCandidate[];
  logicalFiles: LogicalFileCandidate[];
}) {
  const allItems = candidateItems(args.candidates);
  const usedBaselineIds = new Set<string>();
  const processKeys = new Set<string>();
  const processes: any[] = [];

  for (const [index, source] of asArray(raw?.processos).slice(0, 20).entries()) {
    const name = truncate(source?.nome_processo, 300) || `Processo ${index + 1}`;
    const action = truncate(source?.acao_negocio, 120);
    const businessObject = truncate(source?.objeto_negocio, 180);
    const key = normalize(`${action} ${businessObject} ${name}`);
    if (!key || processKeys.has(key)) continue;
    processKeys.add(key);

    const analogs = asArray(source?.baseline_analogas).slice(0, 6).map((analog: any) => {
      const requestedId = String(analog?.baseline_item_id ?? "");
      const exactById = allItems.find((item) => item.id === requestedId);
      const match = exactById
        ? { item: exactById, score: 1 }
        : bestItemMatch(analog?.item_baseline, allItems);
      if (!match) return null;
      return {
        baseline_item_id: match.item.id,
        item_baseline: match.item.description,
        tipo: match.item.function_sigla,
        aderencia: enumValue(analog?.aderencia, ["alta", "media", "baixa"], match.score >= 0.6 ? "alta" : "media"),
        motivo_aderencia: truncate(analog?.motivo_aderencia, 600),
        _score: match.score,
      };
    }).filter(Boolean) as any[];

    if (!analogs.length) {
      const match = bestItemMatch(`${action} ${businessObject} ${name}`, allItems);
      if (match) analogs.push({
        baseline_item_id: match.item.id,
        item_baseline: match.item.description,
        tipo: match.item.function_sigla,
        aderencia: match.score >= 0.6 ? "alta" : match.score >= 0.35 ? "media" : "baixa",
        motivo_aderencia: "Analogia recuperada deterministicamente pelo sistema.",
        _score: match.score,
      });
    }
    analogs.sort((left, right) => right._score - left._score);
    const transactional = analogs.filter((analog) => TRANSACTIONAL_TYPES.has(analog.tipo));
    const primary = transactional[0] ?? null;
    const duplicate = primary ? usedBaselineIds.has(primary.baseline_item_id) : false;
    if (primary && !duplicate) usedBaselineIds.add(primary.baseline_item_id);

    const shouldCount = Boolean(source?.deve_contar_como_processo_elementar);
    const independent = Boolean(source?.independente_dos_demais);
    const requestedRecommendation = enumValue(
      source?.recomendacao_para_contador_existente,
      ["enviar", "nao_enviar", "enviar_com_validacao"],
      "enviar_com_validacao",
    ) as AnalysisRecommendation;
    const risks = asArray(source?.duvidas_ou_riscos)
      .map((risk) => truncate(risk, 500)).filter(Boolean);
    if (duplicate) risks.push("O mesmo item da baseline foi associado a outro processo da análise.");
    const precedent = Boolean(primary && source?.precedente_baseline_encontrado !== false);
    const ready = shouldCount
      && independent
      && precedent
      && Boolean(primary)
      && !duplicate
      && requestedRecommendation === "enviar"
      && risks.length === 0;

    const logicalFiles = asArray(source?.arquivos_logicos_referenciados).slice(0, 10)
      .map((file: any) => {
        const requestedId = String(file?.baseline_item_id ?? "");
        const byId = args.logicalFiles.find((candidate) => candidate.id === requestedId);
        const rankedFiles = args.logicalFiles
          .map((candidate) => ({ candidate, score: lexicalScore(file?.nome, candidate.description) }))
          .sort((left, right) => right.score - left.score);
        const matched = byId ?? (rankedFiles[0]?.score >= 0.25 ? rankedFiles[0].candidate : undefined);
        const requestedType = String(file?.tipo ?? "").toUpperCase();
        return {
          baseline_item_id: matched?.id ?? null,
          nome: matched?.description ?? truncate(file?.nome, 240),
          tipo: matched?.function_sigla
            ?? (LOGICAL_TYPES.has(requestedType) ? requestedType : "desconhecido"),
          papel_no_processo: enumValue(
            file?.papel_no_processo,
            ["mantido", "consultado", "ambos", "desconhecido"],
            "desconhecido",
          ),
        };
      }).filter((file) => file.nome);

    processes.push({
      id_temporario: truncate(source?.id_temporario, 80) || `P${index + 1}`,
      nome_processo: name,
      acao_negocio: action,
      objeto_negocio: businessObject,
      tipo_funcional_candidato: (primary?.tipo
        ?? (TRANSACTIONAL_TYPES.has(String(source?.tipo_funcional_candidato).toUpperCase())
          ? String(source.tipo_funcional_candidato).toUpperCase()
          : "indefinido")) as AnalysisCandidateType,
      deve_contar_como_processo_elementar: shouldCount,
      justificativa_separacao: truncate(source?.justificativa_separacao, 1200),
      resultado_funcional_entregue: truncate(source?.resultado_funcional_entregue, 600),
      independente_dos_demais: independent,
      precedente_baseline_encontrado: precedent,
      baseline_analogas: analogs.map(({ _score, ...analog }) => analog),
      arquivos_logicos_referenciados: logicalFiles,
      sinais_para_o_contador_existente: source?.sinais_para_o_contador_existente ?? {
        campos_percebidos: [], arquivos_referenciados_percebidos: [], observacoes: "",
      },
      duvidas_ou_riscos: risks,
      recomendacao_para_contador_existente: ready
        ? "enviar"
        : shouldCount ? "enviar_com_validacao" : "nao_enviar",
      selected_baseline_item_id: ready ? primary.baseline_item_id : null,
      review_required: shouldCount && !ready,
      confidence: primary ? Math.max(0.3, Math.min(1, primary._score)) : 0.3,
      central: false,
    });
  }

  const requestedCentral = normalize(raw?.processo_central?.nome);
  let centralIndex = processes.findIndex((process) => normalize(process.nome_processo) === requestedCentral);
  if (centralIndex < 0 && processes.length) centralIndex = 0;
  processes.forEach((process, index) => { process.central = index === centralIndex; });

  const reviewCount = processes.filter((process) => process.review_required).length;
  const countableCount = processes.filter(
    (process) => process.recomendacao_para_contador_existente === "enviar",
  ).length;
  const requestedStatus = enumValue(raw?.status_analise, ["ok", "requer_validacao_humana"], "requer_validacao_humana");
  const status = reviewCount > 0 || requestedStatus === "requer_validacao_humana" || !countableCount
    ? "requer_validacao_humana"
    : "ok";

  return {
    hu_id: args.storyId,
    hu_resumo: truncate(raw?.hu_resumo, 1000) || `${args.storyCode} — ${args.storyTitle}`,
    status_analise: status,
    motivo_status: truncate(raw?.motivo_status, 1200)
      || (status === "ok" ? "Processos sustentados pela baseline." : "Existem decisões pendentes de validação."),
    processo_central: {
      nome: processes[centralIndex]?.nome_processo ?? truncate(raw?.processo_central?.nome, 300),
      justificativa: truncate(raw?.processo_central?.justificativa, 1000),
    },
    quantidade_processos_identificados: processes.length,
    processos: processes,
    itens_absorvidos_no_processo_central: asArray(raw?.itens_absorvidos_no_processo_central)
      .slice(0, 30).map((item: any) => ({
        descricao: truncate(item?.descricao, 500),
        motivo_absorcao: truncate(item?.motivo_absorcao, 800),
      })).filter((item) => item.descricao),
    itens_nao_contaveis_como_processo: asArray(raw?.itens_nao_contaveis_como_processo)
      .slice(0, 30).map((item: any) => ({
        descricao: truncate(item?.descricao, 500),
        motivo: truncate(item?.motivo, 800),
      })).filter((item) => item.descricao),
    pendencias_de_detalhamento: asArray(raw?.pendencias_de_detalhamento)
      .slice(0, 30).map((item) => truncate(item, 600)).filter(Boolean),
  };
}

export function buildFallbackStructuredAnalysis(args: {
  storyId: string;
  storyCode: string;
  storyTitle: string;
  storyText: string;
  candidates: ProjectBaselineProcessCandidate[];
  reason: string;
}) {
  const top = args.candidates[0];
  const deterministic = top ? selectDeterministicBaselineItems(args.storyText, top) : null;
  const selectedIds = deterministic?.itemIds
    ?? (top ? selectBaselineItemsForReview(args.storyText, top, 3) : []);
  const selected = top?.items.filter((item) => selectedIds.includes(item.id)) ?? [];
  const processes = selected
    .filter((item) => TRANSACTIONAL_TYPES.has(item.function_sigla))
    .map((item, index) => ({
      id_temporario: `P${index + 1}`,
      nome_processo: item.description,
      acao_negocio: item.description.split(" - ").at(-1)?.split(" ")[0] ?? "",
      objeto_negocio: top?.process_name ?? "",
      tipo_funcional_candidato: item.function_sigla,
      deve_contar_como_processo_elementar: true,
      justificativa_separacao: "Candidato recuperado da baseline, pendente de confirmação humana.",
      resultado_funcional_entregue: item.description,
      independente_dos_demais: false,
      precedente_baseline_encontrado: true,
      baseline_analogas: [{
        baseline_item_id: item.id,
        item_baseline: item.description,
        tipo: item.function_sigla,
        aderencia: "media",
        motivo_aderencia: "Melhor candidato lexical da baseline.",
      }],
      arquivos_logicos_referenciados: [],
      sinais_para_o_contador_existente: {
        campos_percebidos: [], arquivos_referenciados_percebidos: [], observacoes: args.reason,
      },
      duvidas_ou_riscos: [args.reason],
      recomendacao_para_contador_existente: "enviar_com_validacao",
      selected_baseline_item_id: null,
      review_required: true,
      confidence: Number(item.match_score ?? top?.match_score ?? 0.3),
      central: index === 0,
    }));
  return {
    hu_id: args.storyId,
    hu_resumo: `${args.storyCode} — ${args.storyTitle}`,
    status_analise: "requer_validacao_humana",
    motivo_status: args.reason,
    processo_central: {
      nome: processes[0]?.nome_processo ?? args.storyTitle,
      justificativa: "O processo central precisa ser confirmado pelo analista.",
    },
    quantidade_processos_identificados: processes.length,
    processos: processes,
    itens_absorvidos_no_processo_central: [],
    itens_nao_contaveis_como_processo: [],
    pendencias_de_detalhamento: [args.reason],
  };
}

export async function computeProcessAnalysisHash(args: {
  storyId: string;
  storyText: string;
  baselineId: string;
  baselineVersion: string;
  forceNonce?: string;
}) {
  const payload = JSON.stringify({
    storyId: args.storyId,
    storyText: args.storyText,
    baselineId: args.baselineId,
    baselineVersion: args.baselineVersion,
    promptVersion: PROCESS_ANALYSIS_PROMPT_VERSION,
    schemaVersion: PROCESS_ANALYSIS_SCHEMA_VERSION,
    forceNonce: args.forceNonce ?? null,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function buildProjectBaselineItems(args: {
  candidates: ProjectBaselineProcessCandidate[];
  selectedProcessRefs: string[];
  factorSigla: string;
  huRef: string;
  evidence: string;
  confidence: number;
  reasoning: string;
  matchType: "baseline_process_exact" | "baseline_process_ai";
  requiresHumanReview?: boolean;
}) {
  const selectedRefs = new Set(args.selectedProcessRefs.map((ref) => ref.toUpperCase()));
  const selectedItemIds: string[] = [];
  const reviewItemIds = new Set<string>();
  for (const candidate of args.candidates) {
    if (!selectedRefs.has(candidate.process_ref.toUpperCase())) continue;
    const deterministic = selectDeterministicBaselineItems(args.evidence, candidate);
    if (deterministic) {
      selectedItemIds.push(...deterministic.itemIds);
      if (args.requiresHumanReview) deterministic.itemIds.forEach((id) => reviewItemIds.add(id));
    } else if (candidate.items.length === 1) {
      selectedItemIds.push(candidate.items[0].id);
      if (args.requiresHumanReview) reviewItemIds.add(candidate.items[0].id);
    } else {
      const reviewIds = selectBaselineItemsForReview(args.evidence, candidate, 3);
      selectedItemIds.push(...reviewIds);
      reviewIds.forEach((id) => reviewItemIds.add(id));
    }
  }
  return buildSelectedBaselineItems({
    candidates: args.candidates,
    selectedItemIds,
    factorSigla: args.factorSigla,
    huRef: args.huRef,
    evidence: args.evidence,
    confidence: args.confidence,
    reasoning: args.reasoning,
    matchType: args.matchType,
  }).map((item) => reviewItemIds.has(item.baseline_item_id) ? {
    ...item,
    process_is_complete: false,
    process_is_independent: false,
    process_reasoning: "Revisão humana obrigatória antes da contagem.",
  } : item);
}

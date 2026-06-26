import { describe, expect, it } from "vitest";
import type { ProjectBaselineProcessCandidate } from "../types/apfRuntime.types";
import {
  buildFallbackStructuredAnalysis,
  buildProjectBaselineItems,
  buildStructuredProcessAnalysisPrompt,
  hasDeterministicProcessMatch,
  inferImpactFactor,
  normalizeStructuredProcessAnalysis,
  parseStructuredProcessAnalysis,
} from "./projectBaselineCounting.service";

function candidate(
  overrides: Partial<ProjectBaselineProcessCandidate> = {},
): ProjectBaselineProcessCandidate {
  return {
    baseline_id: "baseline-1",
    process_ref: "EF172",
    process_name: "Processo Bancário - Distribuir Processo",
    item_count: 3,
    total_pf_bruto: 10,
    match_score: 0.86,
    items: [
      {
        id: "item-ee",
        item_ref: "EF172:EE:10",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Distribuir Processo",
        module: null,
        function_sigla: "EE",
        baseline_factor_sigla: "I",
        category_sigla: null,
        complexity: "Baixa",
        pf_bruto: 3,
        pf_fs_baseline: 3,
        is_measurable: true,
        notes: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
        match_score: 0.82,
      },
      {
        id: "item-ce-medium",
        item_ref: "EF172:CE:11",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Listar Processos",
        module: null,
        function_sigla: "CE",
        baseline_factor_sigla: "I",
        category_sigla: null,
        complexity: "Média",
        pf_bruto: 4,
        pf_fs_baseline: 4,
        is_measurable: true,
        notes: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
        match_score: 0.25,
      },
      {
        id: "item-ce-low",
        item_ref: "EF172:CE:12",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Selecionar Analista",
        module: null,
        function_sigla: "CE",
        baseline_factor_sigla: "I",
        category_sigla: null,
        complexity: "Baixa",
        pf_bruto: 3,
        pf_fs_baseline: 3,
        is_measurable: true,
        notes: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
        match_score: 0.2,
      },
    ],
    ...overrides,
  };
}

function processDraft(overrides: Record<string, unknown> = {}) {
  return {
    id_temporario: "P1",
    nome_processo: "Distribuir processos bancários",
    acao_negocio: "Distribuir",
    objeto_negocio: "Processo bancário",
    tipo_funcional_candidato: "EE",
    deve_contar_como_processo_elementar: true,
    justificativa_separacao: "Entrega resultado funcional independente.",
    resultado_funcional_entregue: "Processo atribuído ao analista.",
    independente_dos_demais: true,
    precedente_baseline_encontrado: true,
    baseline_analogas: [{
      baseline_item_id: "item-ee",
      item_baseline: "EF172 - Processo Bancário - Distribuir Processo",
      tipo: "EE",
      aderencia: "alta",
      motivo_aderencia: "Mesmo verbo e objeto.",
    }],
    arquivos_logicos_referenciados: [],
    sinais_para_o_contador_existente: {
      campos_percebidos: [],
      arquivos_referenciados_percebidos: [],
      observacoes: "",
    },
    duvidas_ou_riscos: [],
    recomendacao_para_contador_existente: "enviar",
    ...overrides,
  };
}

describe("structured project baseline analysis", () => {
  it("usa alteração como fator padrão para função existente", () => {
    expect(inferImpactFactor(
      "Distribuir processos bancários para um analista",
      ["I", "A", "E"],
    )).toBe("A");
  });

  it("não interpreta remoção incidental como exclusão funcional", () => {
    expect(inferImpactFactor(
      "Título: Distribuir processos. Critérios de Aceite: remover seleção antes de confirmar.",
      ["I", "A", "E"],
    )).toBe("A");
  });

  it("reconhece exclusão, migração e correção no objetivo principal", () => {
    expect(inferImpactFactor("Excluir funcionalidade de processo", ["A", "E"]))
      .toBe("E");
    expect(inferImpactFactor("Migrar os processos legados", ["A", "PMD"]))
      .toBe("PMD");
    expect(inferImpactFactor("Corrigir erro na distribuição", ["A", "COR50"]))
      .toBe("COR50");
  });

  it("reconhece candidato lexical dominante", () => {
    expect(hasDeterministicProcessMatch([
      candidate({ match_score: 0.52 }),
      candidate({ process_ref: "EF200", match_score: 0.28 }),
    ])).toBe(true);
    expect(hasDeterministicProcessMatch([
      candidate({ match_score: 0.4 }),
      candidate({ process_ref: "EF200", match_score: 0.36 }),
    ])).toBe(false);
  });

  it("monta prompt de separação sem limitar artificialmente a dois processos", () => {
    const prompt = buildStructuredProcessAnalysisPrompt({
      storyId: "story-1",
      storyText: "Distribuir processos bancários e listar processos pendentes",
      candidates: [candidate()],
      logicalFiles: [{
        id: "ali-1",
        item_ref: "ALI:PROCESSO",
        description: "Processo Bancário",
        function_sigla: "ALI",
      }],
      precedents: [],
    });

    expect(prompt).toContain("Não existe limite artificial de dois processos");
    expect(prompt).toContain("ALI/AIE nunca são processos");
    expect(prompt).toContain('"item_baseline":"EF172 - Processo Bancário - Distribuir Processo"');
    expect(prompt.length).toBeLessThan(16000);
  });

  it("interpreta JSON estruturado mesmo dentro de markdown", () => {
    const parsed = parseStructuredProcessAnalysis(`
      \`\`\`json
      {"hu_id":"story-1","processos":[${JSON.stringify(processDraft())}]}
      \`\`\`
    `);
    expect(parsed.processos).toHaveLength(1);
    expect(parsed.processos[0].acao_negocio).toBe("Distribuir");
  });

  it("mapeia processo transacional para item real da baseline", () => {
    const normalized = normalizeStructuredProcessAnalysis({
      status_analise: "ok",
      motivo_status: "Correspondência homologada",
      processo_central: { nome: "Distribuir processos bancários", justificativa: "Objetivo principal" },
      processos: [processDraft()],
      itens_absorvidos_no_processo_central: [],
      itens_nao_contaveis_como_processo: [],
      pendencias_de_detalhamento: [],
    }, {
      storyId: "story-1",
      storyCode: "HU-031",
      storyTitle: "Distribuir processos bancários",
      candidates: [candidate()],
      logicalFiles: [],
    });

    expect(normalized.status_analise).toBe("ok");
    expect(normalized.processos).toHaveLength(1);
    expect(normalized.processos[0]).toMatchObject({
      tipo_funcional_candidato: "EE",
      selected_baseline_item_id: "item-ee",
      recomendacao_para_contador_existente: "enviar",
      central: true,
    });
  });

  it("não aceita ALI como processo elementar", () => {
    const dataCandidate = candidate({
      process_ref: "DATA:PROCESSO",
      items: [{
        ...candidate().items[0],
        id: "ali-processo",
        item_ref: "ALI:PROCESSO",
        description: "Processo Bancário",
        function_sigla: "ALI",
      }],
    });
    const normalized = normalizeStructuredProcessAnalysis({
      status_analise: "ok",
      processo_central: { nome: "Processo Bancário", justificativa: "" },
      processos: [processDraft({
        nome_processo: "Processo Bancário",
        tipo_funcional_candidato: "ALI",
        baseline_analogas: [{
          baseline_item_id: "ali-processo",
          item_baseline: "Processo Bancário",
          tipo: "ALI",
          aderencia: "alta",
          motivo_aderencia: "Arquivo lógico",
        }],
      })],
    }, {
      storyId: "story-1",
      storyCode: "HU-031",
      storyTitle: "Distribuir processos",
      candidates: [dataCandidate],
      logicalFiles: [],
    });

    expect(normalized.status_analise).toBe("requer_validacao_humana");
    expect(normalized.processos[0].tipo_funcional_candidato).toBe("indefinido");
    expect(normalized.processos[0].selected_baseline_item_id).toBeNull();
  });

  it("permite mais de dois processos quando todos têm sustentação", () => {
    const candidates = [0, 1, 2].map((index) => candidate({
      process_ref: `EF17${index}`,
      items: [{
        ...candidate().items[0],
        id: `item-${index}`,
        item_ref: `EF17${index}:EE`,
        description: `Função independente ${index}`,
      }],
    }));
    const normalized = normalizeStructuredProcessAnalysis({
      status_analise: "ok",
      processo_central: { nome: "Função independente 0", justificativa: "Principal" },
      processos: candidates.map((entry, index) => processDraft({
        id_temporario: `P${index + 1}`,
        nome_processo: `Função independente ${index}`,
        acao_negocio: `Ação ${index}`,
        baseline_analogas: [{
          baseline_item_id: `item-${index}`,
          item_baseline: `Função independente ${index}`,
          tipo: "EE",
          aderencia: "alta",
          motivo_aderencia: "Precedente exato",
        }],
      })),
    }, {
      storyId: "story-1",
      storyCode: "HU-001",
      storyTitle: "HU multifuncional",
      candidates,
      logicalFiles: [],
    });

    expect(normalized.processos).toHaveLength(3);
    expect(normalized.status_analise).toBe("ok");
  });

  it("gera fallback em revisão sem enviar PF automaticamente", () => {
    const fallback = buildFallbackStructuredAnalysis({
      storyId: "story-1",
      storyCode: "HU-031",
      storyTitle: "Distribuir processos",
      storyText: "Distribuir processos bancários",
      candidates: [candidate()],
      reason: "Resposta da IA inválida",
    });

    expect(fallback.status_analise).toBe("requer_validacao_humana");
    expect(fallback.processos[0].recomendacao_para_contador_existente)
      .toBe("enviar_com_validacao");
    expect(fallback.processos[0].selected_baseline_item_id).toBeNull();
  });

  it("mantém compatibilidade com a materialização anterior", () => {
    const items = buildProjectBaselineItems({
      candidates: [candidate()],
      selectedProcessRefs: ["EF172"],
      factorSigla: "A",
      huRef: "HU-031",
      evidence: "Distribuir processos bancários",
      confidence: 0.86,
      reasoning: "Correspondência dominante",
      matchType: "baseline_process_exact",
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      baseline_item_id: "item-ee",
      function_sigla: "EE",
      factor_sigla: "A",
    });
  });
});

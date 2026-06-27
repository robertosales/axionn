export const GESP3_METRIC_PRECEDENTS_VERSION = "release-05-20260608";

export interface GESP3MetricPrecedent {
  referenceCode: string;
  description: string;
  functionSigla: "TRN" | "N/A";
  factorSigla: "I" | "A" | "N/A";
  pfBruto: number;
  pfFs: number;
  isMeasurable: boolean;
  notes?: string;
}

const rows: GESP3MetricPrecedent[] = [
  { referenceCode: "HU211.3", description: "Avaliar Relatório de Vistoria", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU049.1", description: "Criar e Preencher Relatório de Vistoria", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU049.2", description: "Avaliar Relatório de Vistoria", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU049.3", description: "Baixar Modelo de Relatório de Vistoria", functionSigla: "N/A", factorSigla: "N/A", pfBruto: 0, pfFs: 0, isMeasurable: false, notes: "Impressão de template em branco." },
  { referenceCode: "HU049.4", description: "Gerar Documento de Relatório de Vistoria Preenchido", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU049.5", description: "Realizar Upload de Documento de Relatório de Vistoria", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU050", description: "Controlar Estado e Decisão do Subprocesso", functionSigla: "N/A", factorSigla: "N/A", pfBruto: 0, pfFs: 0, isMeasurable: false, notes: "Descreve comportamentos de diversas funcionalidades." },
  { referenceCode: "HU051", description: "Controlar Estado do Processo com base nos Subprocessos", functionSigla: "N/A", factorSigla: "N/A", pfBruto: 0, pfFs: 0, isMeasurable: false, notes: "Descreve comportamentos de diversas funcionalidades." },
  { referenceCode: "HU052", description: "Gerar e Registrar Decisão Administrativa", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU053", description: "Listar Processos em Aguardando Subprocessos", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU054", description: "Controlar Prazos de Notificação", functionSigla: "N/A", factorSigla: "N/A", pfBruto: 0, pfFs: 0, isMeasurable: false, notes: "Descreve comportamentos de diversas funcionalidades." },
  { referenceCode: "HU055", description: "Emitir Parecer do Processo Autorizativo", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU055.1", description: "Gerar e Encaminhar Parecer de Deferimento", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU055.2", description: "Gerar e Encaminhar Parecer de Indeferimento", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU056", description: "Encaminhar Parecer Técnico no Fluxo", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU057", description: "Listar Processos para Aprovação de Parecer de Deferimento DPSP", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU058", description: "Aprovar Parecer de Deferimento DPSP", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU059", description: "Listar Processos para Aprovação de Parecer de Deferimento CGCSP", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU060", description: "Aprovar Parecer de Deferimento CGCSP", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU211", description: "Exibir Relatórios de Vistoria", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU211.1", description: "Criar e Preencher Relatório de Vistoria", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU212", description: "Disponibilizar Ações de Decisão Administrativa", functionSigla: "N/A", factorSigla: "N/A", pfBruto: 0, pfFs: 0, isMeasurable: false, notes: "Detalha funcionalidades nas HUs 213, 214 e 215." },
  { referenceCode: "HU213", description: "Gerar e Encaminhar Parecer de Deferimento", functionSigla: "TRN", factorSigla: "I", pfBruto: 4.6, pfFs: 4.6, isMeasurable: true },
  { referenceCode: "HU200", description: "Distribuir Processo Bancário", functionSigla: "TRN", factorSigla: "A", pfBruto: 4.6, pfFs: 2.76, isMeasurable: true },
  { referenceCode: "HU201", description: "Redistribuir Processo Bancário", functionSigla: "TRN", factorSigla: "A", pfBruto: 4.6, pfFs: 2.76, isMeasurable: true },
];

export const GESP3_METRIC_PRECEDENTS = new Map(
  rows.map((row) => [row.referenceCode, row]),
);

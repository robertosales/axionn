import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  FolderKanban, ArrowLeft, XCircle, AlertTriangle, ChevronRight,
  Search, PlusCircle, MinusCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { upsertDemandas } from "../services/demandas.service";
import { TIPOS_DEMANDA_IMR, calcPrazoInicio, calcPrazoSolucao } from "../types/imr";
import { parse, isValid, format } from "date-fns";
import {
  ImportacaoPreviewTable,
  type PreviewRow,
  type RowStatus,
} from "./ImportacaoPreviewTable";
import { cn } from "@/lib/utils";
import { fetchProjetosForImport, type ProjetoImport } from "@/features/admin/services/projects.service";
import { useContracts } from "@/features/admin/hooks/useContracts";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ─── SheetJS CDN loader ────────────────────────────────────────────────────
declare global { interface Window { XLSX: any; } }
const XLSX_CDN = "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
function loadXLSX(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = XLSX_CDN;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("Falha ao carregar a biblioteca de leitura de Excel."));
    document.head.appendChild(s);
  });
}
function isXlsxFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls")
    || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || file.type === "application/vnd.ms-excel";
}
async function parseXlsxToRows(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return json.map((row) => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(row)) out[k.trim()] = row[k] == null ? "" : String(row[k]).trim();
    return out;
  });
}

// ─── Mapas de normalização ─────────────────────────────────────────────────

const SITUACAO_MAP: Record<string, string> = {
  fila_atendimento:          "fila_atendimento",
  planejamento_elaboracao:   "planejamento_elaboracao",
  planejamento_ag_aprovacao: "planejamento_ag_aprovacao",
  planejamento_aprovada:     "planejamento_aprovada",
  em_execucao:               "em_execucao",
  bloqueada:                 "bloqueada",
  hom_ag_homologacao:        "hom_ag_homologacao",
  hom_homologada:            "hom_homologada",
  rejeitada:                 "rejeitada",
  fila_producao:             "fila_producao",
  ag_aceite_final:           "ag_aceite_final",
  cancelada:                 "cancelada",
  fila_concluida:            "fila_concluida",
  "fila de atendimento":             "fila_atendimento",
  nova:                              "fila_atendimento",
  aberta:                            "fila_atendimento",
  "em aberto":                       "fila_atendimento",
  "planejamento: em elaboracao":     "planejamento_elaboracao",
  "planejamento: ag. aprovacao":     "planejamento_ag_aprovacao",
  "planejamento: aprovada p/ exec":  "planejamento_aprovada",
  "em execucao":                     "em_execucao",
  "em andamento":                    "em_execucao",
  iniciada:                          "em_execucao",
  "hom: ag. homologacao":            "hom_ag_homologacao",
  "hom: homologada":                 "hom_homologada",
  homologada:                        "hom_homologada",
  "fila para producao (infra)":      "fila_producao",
  "fila infra":                      "fila_producao",
  "ag. aceite final":                "ag_aceite_final",
  "aguardando aceite final":         "ag_aceite_final",
  "aceite pendente":                 "ag_aceite_final",
  concluida:                         "fila_concluida",
  "fila concluida":                  "fila_concluida",
  "fila de concluidas":              "fila_concluida",
  encerrada:                         "fila_concluida",
  finalizada:                        "fila_concluida",
  cancelado:                         "cancelada",
  bloqueado:                         "bloqueada",
  rejeitado:                         "rejeitada",
  suspensa:                          "bloqueada",
  suspensa_cliente:                  "bloqueada",
  suspensa_cliente_aguardando:       "bloqueada",
  "aguardando cliente":              "bloqueada",
  "aguardando retorno":              "bloqueada",
  "aguardando retorno do cliente":   "bloqueada",
  aguardando:                        "bloqueada",
  "aguardando informacao":           "bloqueada",
  "aguardando informacoes":          "bloqueada",
  "em espera":                       "bloqueada",
  suspensa_interna:                  "bloqueada",
  impedida:                          "bloqueada",
  impedido:                          "bloqueada",
  "on hold":                         "bloqueada",
  hold:                              "bloqueada",
};

function normalizeSituacao(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return SITUACAO_MAP[cleaned] || SITUACAO_MAP[raw.trim().toLowerCase()] || null;
}

const VALID_TIPOS_MAP: Record<string, string> = {};
TIPOS_DEMANDA_IMR.forEach((t) => {
  VALID_TIPOS_MAP[t.label.toLowerCase()] = t.value;
  VALID_TIPOS_MAP[t.value] = t.value;
});

function normalize(str: string): string {
  return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function removeEmojis(str: string): string {
  return str.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}]/gu,
    "",
  ).trim();
}

function parseDataInicio(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isValid(raw) ? raw : null;
  const str = String(raw).trim();
  let d = parse(str, "dd/MM/yyyy HH:mm", new Date());
  if (isValid(d)) return d;
  d = parse(str, "dd/MM/yyyy", new Date());
  if (isValid(d)) return d;
  d = new Date(str);
  return isValid(d) ? d : null;
}

function normalizeTipo(raw: string): { value: string; autoCreated: boolean } | null {
  const lower = raw.toLowerCase().trim();
  if (!lower) return null;
  if (VALID_TIPOS_MAP[lower]) return { value: VALID_TIPOS_MAP[lower], autoCreated: false };
  for (const [key, val] of Object.entries(VALID_TIPOS_MAP)) {
    if (key.includes(lower) || lower.includes(key)) return { value: val, autoCreated: false };
  }
  if (lower === "corretiva") return { value: "manutencao_corretiva", autoCreated: false };
  if (lower === "evolutiva") return { value: "evolutiva_pequeno_porte", autoCreated: false };
  const autoKey = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return { value: autoKey || lower.replace(/\s+/g, "_"), autoCreated: true };
}

interface ValidationError { linha: number; mensagem: string; }
interface ParsedRow extends PreviewRow { data_inicio: Date; }
type ImportMode = null | "demandas" | "projetos";
interface FailedRow { rhm: string; projeto: string; motivo: string; }

// ─── Tipos para preview de projetos ────────────────────────────────────────

type ProjetoAcao = "novo" | "existente" | "erro_validacao";

interface ProjetoPreviewRow {
  linha:       number;
  nome:        string;
  descricao:   string | null;
  code:        string | null;
  redmineId:   number | null;
  moduleType:  string;
  acao:        ProjetoAcao;
  motivoErro?: string;
  status:      "pendente" | "importando" | "importado" | "ignorado" | "erro";
}

type ProjetoFilterAcao = "todos" | ProjetoAcao;

const PROJETO_FILTER_OPTIONS: { key: ProjetoFilterAcao; label: string }[] = [
  { key: "todos",          label: "Todos" },
  { key: "novo",           label: "Novos" },
  { key: "existente",      label: "Já existentes" },
  { key: "erro_validacao", label: "Erros" },
];

const PROJETO_ACAO_CONFIG: Record<ProjetoAcao, { label: string; dot: string; pill: string }> = {
  novo:           { label: "Novo",         dot: "bg-emerald-500",       pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  existente:      { label: "Já existente", dot: "bg-muted-foreground/40", pill: "bg-muted text-muted-foreground border-border" },
  erro_validacao: { label: "Erro",         dot: "bg-destructive",        pill: "bg-destructive/10 text-destructive border-destructive/20" },
};

const MODULE_LABELS: Record<string, string> = {
  agile:      "Ágile",
  mixed:      "Misto",
  sustenance: "Sustentação",
};

// ─── Componente principal ──────────────────────────────────────────────────

export function ImportacaoView() {
  const { currentTeamId } = useAuth();

  const [allProjetos, setAllProjetos] = useState<ProjetoImport[]>([]);
  const { contracts } = useContracts();

  useEffect(() => {
    loadXLSX().catch(() => {});
    fetchProjetosForImport().then(setAllProjetos).catch(() => {});
  }, []);

  const [mode, setMode]                         = useState<ImportMode>(null);
  const [loading, setLoading]                   = useState(false);
  const [validRows, setValidRows]               = useState<ParsedRow[]>([]);
  const [autoCreatedTypes, setAutoCreatedTypes] = useState<string[]>([]);
  const [errors, setErrors]                     = useState<ValidationError[]>([]);
  const [showPreview, setShowPreview]           = useState(false);
  const [progressMap, setProgressMap]           = useState<Map<string, RowStatus>>(new Map());
  const [result, setResult] = useState<{
    importados: number; atualizados: number; erros: number;
    tiposCriados?: string[]; falhas?: FailedRow[];
  } | null>(null);

  // ─── Estado de projetos ─────────────────────────────────────────────────
  const [projetoContractId,   setProjetoContractId]   = useState<string>("");
  const [projetoPreviewRows,  setProjetoPreviewRows]  = useState<ProjetoPreviewRow[]>([]);
  const [showProjetoPreview,  setShowProjetoPreview]  = useState(false);
  const [projetoProgressMap,  setProjetoProgressMap]  = useState<Map<number, "importando" | "importado" | "ignorado" | "erro">>(new Map());
  const [projetoResult, setProjetoResult] = useState<{
    importados: number; existentes: number; erros: number; falhas: { nome: string; motivo: string }[];
  } | null>(null);
  const [projetoSearch,     setProjetoSearch]     = useState("");
  const [projetoFilter,     setProjetoFilter]     = useState<ProjetoFilterAcao>("todos");
  const [projetoPagina,     setProjetoPagina]     = useState(1);
  const [projetoArquivoErro, setProjetoArquivoErro] = useState<string | null>(null);
  const PROJETO_PAGE_SIZE = 20;

  const inputRef = useRef<HTMLInputElement>(null);

  const projetoMap = new Map(
    allProjetos.map((p) => [
      normalize(p.name),
      { id: p.id, nome: p.name, teamId: p.team_id ?? "" },
    ]),
  );

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function parseCsvToRows(buffer: ArrayBuffer): Record<string, string>[] {
    const text  = new TextDecoder("utf-8").decode(buffer);
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];
    lines[0] = lines[0].replace(/^\uFEFF/, "");
    const headers = lines[0].split(";").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(";");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (values[i] || "").trim(); });
      return obj;
    });
  }

  function cancelPreview() {
    setShowPreview(false); setValidRows([]); setErrors([]);
    setAutoCreatedTypes([]); setProgressMap(new Map());
  }

  function cancelProjetoPreview() {
    setShowProjetoPreview(false); setProjetoPreviewRows([]);
    setProjetoProgressMap(new Map()); setProjetoSearch(""); setProjetoFilter("todos"); setProjetoPagina(1);
  }

  // ─── Upload demandas ──────────────────────────────────────────────────────

  const handleFileDemandas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeamId) return;
    setResult(null); setShowPreview(false); setErrors([]); setValidRows([]); setProgressMap(new Map());
    try {
      const buffer = await file.arrayBuffer();
      const rows   = isXlsxFile(file) ? await parseXlsxToRows(buffer) : parseCsvToRows(buffer);
      const parsed: ParsedRow[]       = [];
      const errs:   ValidationError[] = [];
      const newTypes: string[]        = [];

      rows.forEach((r, idx) => {
        const linha       = idx + 2;
        const rhm         = String(r["#"] || r["RHM"] || r["rhm"] || "").trim();
        const projetoNome = String(r["Projeto"] || r["projeto"] || "").trim();
        const tipoRaw     = String(r["Tipo"] || r["tipo"] || "").trim();
        const dataInicioRaw = r["Criado em"] || r["Criado Em"] || r["Data de Início"] || r["Data de Inicio"] || r["data_inicio"] || null;
        const descricao = String(r["Título"] || r["Titulo"] || r["Subject"] || r["Descrição"] || r["descricao"] || "").trim() || undefined;

        if (!rhm)         { errs.push({ linha, mensagem: "# não informado." }); return; }
        if (!projetoNome) { errs.push({ linha, mensagem: "Projeto não informado." }); return; }

        const projetoInfo = projetoMap.get(normalize(projetoNome));
        if (!projetoInfo) {
          errs.push({ linha, mensagem: `Projeto "${projetoNome}" não encontrado em public.projects. Cadastre-o no Admin antes de importar.` });
          return;
        }

        if (!tipoRaw) { errs.push({ linha, mensagem: "Tipo não informado." }); return; }
        const tipoResult = normalizeTipo(tipoRaw);
        if (!tipoResult) { errs.push({ linha, mensagem: `Tipo '${tipoRaw}' não reconhecido.` }); return; }
        if (tipoResult.autoCreated && !newTypes.includes(tipoRaw)) newTypes.push(tipoRaw);
        const tipoNorm = tipoResult.value;

        if (!dataInicioRaw) { errs.push({ linha, mensagem: "Criado em inválido ou ausente." }); return; }
        const dataInicio = parseDataInicio(dataInicioRaw);
        if (!dataInicio)    { errs.push({ linha, mensagem: "Criado em inválido ou ausente." }); return; }

        const situacaoRaw   = String(r["Situação"] || r["Situacao"] || r["situacao"] || "Nova").trim();
        const situacaoLimpa = removeEmojis(situacaoRaw);
        const situacao = normalizeSituacao(situacaoLimpa);
        if (!situacao) {
          errs.push({ linha, mensagem: `Situação '${situacaoRaw}' não reconhecida. Use uma situação válida do cadastro.` });
          return;
        }

        const isCorretiva = tipoNorm === "manutencao_corretiva";
        let sla = "padrao";
        const regimeRaw = String(r["Regime de Atendimento"] || r["Regime"] || r["regime"] || "").trim();
        if (isCorretiva && /\d+\s*x\s*7/i.test(regimeRaw)) sla = "continuo";
        else if (isCorretiva && normalize(regimeRaw) === "continuo") sla = "continuo";

        let tipo_defeito: string | undefined;
        const defeitoRaw = String(r["Defeito Impeditivo"] || r["Tipo de Defeito"] || r["tipo_defeito"] || "").trim().toLowerCase();
        if (isCorretiva && defeitoRaw) {
          tipo_defeito = defeitoRaw === "sim" || defeitoRaw === "impeditivo" ? "impeditivo" : "nao_impeditivo";
        } else if (isCorretiva) { tipo_defeito = "impeditivo"; }

        let originada_diagnostico = false;
        const diagRaw = String(r["Originada de Diagnóstico"] || r["Originada de Diagnostico"] || "").trim().toLowerCase();
        if (isCorretiva && (diagRaw === "sim" || diagRaw === "true" || diagRaw === "1")) originada_diagnostico = true;

        const regime       = isCorretiva ? sla : undefined;
        const defeito      = isCorretiva ? tipo_defeito : undefined;
        const prazoInicio  = calcPrazoInicio(dataInicio, tipoNorm, regime, defeito);
        const prazoSolucao = calcPrazoSolucao(dataInicio, tipoNorm, regime, defeito);
        const prevEncRaw   = r["Data de Previsão de Encerramento"] || r["Data Previsão Encerramento"] || null;
        let prevEnc: string | undefined;
        if (prevEncRaw) { const d = parseDataInicio(prevEncRaw); if (d) prevEnc = format(d, "yyyy-MM-dd"); }

        parsed.push({
          rhm,
          projeto:   projetoInfo.nome,
          projectId: projetoInfo.id,
          teamId:    projetoInfo.teamId,
          tipo:      tipoNorm,
          data_inicio: dataInicio,
          situacao, sla, tipo_defeito, originada_diagnostico, descricao,
          data_previsao_encerramento: prevEnc || (prazoSolucao ? format(prazoSolucao, "yyyy-MM-dd") : undefined),
          prazo_inicio_atendimento:   prazoInicio?.toISOString(),
          prazo_solucao:              prazoSolucao?.toISOString(),
        });
      });

      setValidRows(parsed); setErrors(errs); setAutoCreatedTypes(newTypes);
      if (parsed.length === 0 && errs.length === 0) toast.error("Nenhuma linha encontrada.");
      else setShowPreview(true);
    } catch { toast.error("Erro ao processar arquivo."); }
    finally  { if (inputRef.current) inputRef.current.value = ""; }
  };

  // ─── Validação prévia de projetos ─────────────────────────────────────────────
  // FIX Bug 1: setLoading(false) sempre garantido via finally
  // FIX Bug 2: estado projetoArquivoErro exibe banner visual
  // FIX Bug 3: preview só abre se houver linhas válidas

  const handleFileProjetos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    if (!projetoContractId) {
      toast.error("Selecione o contrato antes de fazer o upload.");
      return;
    }

    setProjetoResult(null);
    setProjetoArquivoErro(null);
    cancelProjetoPreview();
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const rows   = isXlsxFile(file) ? await parseXlsxToRows(buffer) : parseCsvToRows(buffer);

      if (rows.length === 0) {
        setProjetoArquivoErro(
          "O arquivo não contém linhas de dados. Verifique se a planilha tem pelo menos uma linha além do cabeçalho.",
        );
        return;
      }

      const sampleKeys = Object.keys(rows[0]);
      const hasNome = sampleKeys.some((k) => ["Nome", "nome", "name"].includes(k));
      if (!hasNome) {
        const colunasEncontradas = sampleKeys.length > 0
          ? sampleKeys.slice(0, 6).join(", ") + (sampleKeys.length > 6 ? "…" : "")
          : "nenhuma";
        setProjetoArquivoErro(
          `Coluna obrigatória 'Nome' não encontrada. ` +
          `Colunas detectadas: ${colunasEncontradas}. ` +
          `O arquivo deve conter as colunas: Nome, Descrição, Código, Redmine ID, Módulo.`,
        );
        return;
      }

      const fresh = await fetchProjetosForImport();
      const existingNorms = new Set(fresh.map((p) => normalize(p.name)));

      const preview: ProjetoPreviewRow[] = rows.map((r, idx) => {
        const linha      = idx + 2;
        const nome       = String(r["Nome"] || r["nome"] || r["name"] || "").trim();
        const descricao  = String(r["Descrição"] || r["Descricao"] || r["descricao"] || "").trim() || null;
        const code       = String(r["Código"] || r["Codigo"] || r["code"] || "").trim() || null;
        const redmine_raw = String(r["Redmine ID"] || r["redmine_id"] || "").trim();
        const redmineId  = redmine_raw ? (Number(redmine_raw) || null) : null;
        const modRaw     = String(r["Módulo"] || r["Modulo"] || r["module_type"] || "").trim().toLowerCase();
        const moduleType = modRaw === "agile" || modRaw === "agil" ? "agile"
                         : modRaw === "mixed" || modRaw === "misto" ? "mixed" : "sustenance";

        if (!nome) {
          return {
            linha, nome: `(linha ${linha} — sem nome)`, descricao, code, redmineId, moduleType,
            acao: "erro_validacao" as ProjetoAcao,
            motivoErro: "Campo 'Nome' está vazio nesta linha.",
            status: "pendente" as const,
          };
        }

        if (existingNorms.has(normalize(nome))) {
          return { linha, nome, descricao, code, redmineId, moduleType, acao: "existente" as ProjetoAcao, status: "pendente" as const };
        }

        return { linha, nome, descricao, code, redmineId, moduleType, acao: "novo" as ProjetoAcao, status: "pendente" as const };
      });

      const linhasUteis = preview.filter((r) => r.acao !== "erro_validacao");
      if (linhasUteis.length === 0 && preview.length > 0) {
        setProjetoArquivoErro(
          `Todas as ${preview.length} linha(s) do arquivo têm o campo 'Nome' vazio. ` +
          `Verifique se o arquivo está no formato correto: Nome, Descrição, Código, Redmine ID, Módulo.`,
        );
        return;
      }

      setProjetoPreviewRows(preview);
      setShowProjetoPreview(true);
    } catch {
      toast.error("Erro ao processar arquivo.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Confirmação da importação de projetos ────────────────────────────────

  const handleConfirmarProjetos = async () => {
    const toImport = projetoPreviewRows.filter((r) => r.acao === "novo");
    if (toImport.length === 0) { toast.error("Nenhum projeto novo para importar."); return; }

    setLoading(true);
    const results = { importados: 0, existentes: projetoPreviewRows.filter((r) => r.acao === "existente").length, erros: 0 };
    const falhas: { nome: string; motivo: string }[] = [];
    const { supabase: sb } = await import("@/integrations/supabase/client");

    for (const row of toImport) {
      setProjetoProgressMap((prev) => new Map(prev).set(row.linha, "importando"));
      try {
        const { error } = await (sb as any).from("projects").upsert(
          {
            contract_id: projetoContractId,
            team_id:     currentTeamId || null,
            name:        row.nome,
            description: row.descricao,
            code:        row.code,
            redmine_id:  row.redmineId,
            module_type: row.moduleType,
            status:      "active",
          },
          { onConflict: "name,contract_id", ignoreDuplicates: true },
        );
        if (error) throw error;
        results.importados++;
        setProjetoProgressMap((prev) => new Map(prev).set(row.linha, "importado"));
      } catch (err: any) {
        results.erros++;
        const motivo = err?.message ?? "Erro desconhecido";
        falhas.push({ nome: row.nome, motivo });
        setProjetoProgressMap((prev) => new Map(prev).set(row.linha, "erro"));
      }
    }

    setProjetoResult({ ...results, falhas });
    setShowProjetoPreview(false);
    cancelProjetoPreview();
    toast.success(`Concluída: ${results.importados} importados, ${results.existentes} já existentes`);
    fetchProjetosForImport().then(setAllProjetos).catch(() => {});
    setLoading(false);
  };

  // ─── Migração demandas ────────────────────────────────────────────────────

  const handleImport = async (selectedRows: PreviewRow[]) => {
    if (!currentTeamId || selectedRows.length === 0) return;
    setLoading(true);
    setProgressMap(new Map(selectedRows.map((r) => [r.rhm, "atualizando" as RowStatus])));

    const existsInDb  = new Set<string>();
    const byTeamCheck = new Map<string, string[]>();
    for (const row of selectedRows) {
      const list = byTeamCheck.get(row.teamId) ?? []; list.push(row.rhm); byTeamCheck.set(row.teamId, list);
    }
    const { supabase: sb } = await import("@/integrations/supabase/client");
    for (const [teamId, rhms] of byTeamCheck) {
      const { data } = await (sb as any).from("demandas").select("rhm").eq("team_id", teamId).in("rhm", rhms);
      if (data) for (const d of data as any[]) existsInDb.add(`${teamId}:${d.rhm}`);
    }

    const totals = { importados: 0, atualizados: 0, erros: 0 };
    const falhas: FailedRow[] = [];
    const byTeam = new Map<string, PreviewRow[]>();
    for (const row of selectedRows) {
      const group = byTeam.get(row.teamId) ?? []; group.push(row); byTeam.set(row.teamId, group);
    }

    for (const [teamId, rows] of byTeam) {
      try {
        const res = await upsertDemandas(teamId, rows.map((row) => ({
          rhm:                        row.rhm,
          projeto:                    row.projeto,
          project_id:                 row.projectId ?? null,
          situacao:                   row.situacao || "fila_atendimento",
          tipo:                       row.tipo,
          sla:                        row.sla,
          descricao:                  row.descricao,
          tipo_defeito:               row.tipo_defeito,
          originada_diagnostico:      row.originada_diagnostico,
          data_previsao_encerramento: row.data_previsao_encerramento,
          prazo_inicio_atendimento:   row.prazo_inicio_atendimento,
          prazo_solucao:              row.prazo_solucao,
        })));
        totals.importados  += res.importados;
        totals.atualizados += res.atualizados;
        totals.erros       += res.erros;
        if (res.falhas?.length) {
          for (const f of res.falhas) falhas.push({ rhm: f.rhm, projeto: f.projeto, motivo: f.motivo });
          setProgressMap((prev) => { const next = new Map(prev); for (const f of res.falhas!) next.set(f.rhm, "erro"); return next; });
        }
        setProgressMap((prev) => {
          const next = new Map(prev);
          for (const row of rows) {
            if (next.get(row.rhm) !== "erro")
              next.set(row.rhm, existsInDb.has(`${teamId}:${row.rhm}`) ? "atualizado" : "criado");
          }
          return next;
        });
      } catch (err: any) {
        totals.erros += rows.length;
        const motivo = err?.message ?? "Erro desconhecido";
        setProgressMap((prev) => { const next = new Map(prev); for (const row of rows) next.set(row.rhm, "erro"); return next; });
        for (const row of rows) falhas.push({ rhm: row.rhm, projeto: row.projeto, motivo });
      }
    }
    const tipoMsg = autoCreatedTypes.length > 0 ? ` | ${autoCreatedTypes.length} tipo(s) criado(s) automaticamente` : "";
    toast.success(`Importação concluída: ${totals.importados} novos, ${totals.atualizados} atualizados${tipoMsg}`);
    setResult({ ...totals, tiposCriados: autoCreatedTypes, falhas });
    setShowPreview(false); setLoading(false);
  };

  // ─── Derived: preview projetos filtrado ───────────────────────────────────

  const projetoRowsDisplay = useMemo(() => {
    let r = projetoPreviewRows.map((row) => ({
      ...row,
      status: projetoProgressMap.get(row.linha) ?? row.status,
    }));
    if (projetoFilter !== "todos") r = r.filter((x) => x.acao === projetoFilter);
    if (projetoSearch.trim()) {
      const q = projetoSearch.trim().toLowerCase();
      r = r.filter((x) => x.nome.toLowerCase().includes(q) || String(x.linha).includes(q));
    }
    return r;
  }, [projetoPreviewRows, projetoProgressMap, projetoFilter, projetoSearch]);

  const projetoTotalPages = Math.max(1, Math.ceil(projetoRowsDisplay.length / PROJETO_PAGE_SIZE));
  const projetoSafePage   = Math.min(projetoPagina, projetoTotalPages);
  const projetoPagedRows  = useMemo(
    () => projetoRowsDisplay.slice((projetoSafePage - 1) * PROJETO_PAGE_SIZE, projetoSafePage * PROJETO_PAGE_SIZE),
    [projetoRowsDisplay, projetoSafePage],
  );

  const projetoCounts = useMemo(() => ({
    novos:      projetoPreviewRows.filter((r) => r.acao === "novo").length,
    existentes: projetoPreviewRows.filter((r) => r.acao === "existente").length,
    erros:      projetoPreviewRows.filter((r) => r.acao === "erro_validacao").length,
  }), [projetoPreviewRows]);

  // ─── Render: seleção de modo ───────────────────────────────────────────────

  if (mode === null) {
    return (
      <div className="w-full max-w-xl mx-auto pt-8 space-y-5">
        <div className="text-center space-y-1 pb-2">
          <h2 className="text-2xl font-bold text-foreground">Importação de Dados</h2>
          <p className="text-sm text-muted-foreground">Escolha o tipo de importação para continuar</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => setMode("demandas")}
            className="w-full group flex items-center gap-5 p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
              <FileSpreadsheet className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground">Demandas (Redmine)</p>
              <p className="text-sm text-muted-foreground mt-0.5">Importar planilha .csv ou .xlsx exportada do Redmine</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
          <button
            onClick={() => setMode("projetos")}
            className="w-full group flex items-center gap-5 p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-violet-400 dark:hover:border-violet-500 transition-all duration-200 text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 dark:bg-violet-500/15 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors">
              <FolderKanban className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground">Projetos de Sustentação</p>
              <p className="text-sm text-muted-foreground mt-0.5">Importar sistemas de sustentação via .csv ou .xlsx</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: preview de demandas ───────────────────────────────────────────

  if (showPreview) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
          <button onClick={cancelPreview} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div>
            <h2 className="text-base font-semibold text-foreground">Prévia da Importação</h2>
            <p className="text-xs text-muted-foreground">{validRows.length} registro(s) processado(s)</p>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <ImportacaoPreviewTable
            rows={validRows}
            onConfirm={handleImport}
            onCancel={cancelPreview}
            loading={loading}
            progressMap={progressMap}
          />
        </div>
      </div>
    );
  }

  // ─── Render: tela demandas ─────────────────────────────────────────────────

  if (mode === "demandas") {
    return (
      <div className="w-full max-w-2xl mx-auto pt-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setMode(null); setResult(null); setErrors([]); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground">Importar Demandas</h2>
            <p className="text-sm text-muted-foreground">Planilha .csv ou .xlsx exportada do Redmine</p>
          </div>
        </div>

        <label className="flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed border-border hover:border-blue-400 dark:hover:border-blue-500 bg-muted/30 hover:bg-blue-500/5 transition-all cursor-pointer group">
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileDemandas} />
          <Upload className="h-10 w-10 text-muted-foreground/50 group-hover:text-blue-500 transition-colors mb-3" />
          <p className="text-sm font-medium text-foreground">Clique ou arraste o arquivo aqui</p>
          <p className="text-xs text-muted-foreground mt-1">.csv ou .xlsx — exportação padrão do Redmine</p>
        </label>

        {errors.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">{errors.length} erro(s) encontrado(s)</p>
            </div>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-destructive/80">Linha {e.linha}: {e.mensagem}</li>
              ))}
            </ul>
          </div>
        )}

        {autoCreatedTypes.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">Tipos criados automaticamente</p>
            </div>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
              Os seguintes tipos não foram reconhecidos e serão criados: {autoCreatedTypes.join(", ")}
            </p>
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">Importação concluída</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ResultCard count={result.importados}  label="Novos"      color="emerald" />
              <ResultCard count={result.atualizados} label="Atualizados" color="sky" />
              <ResultCard count={result.erros}       label="Erros"       color="red" />
            </div>
            {result.falhas && result.falhas.length > 0 && (
              <FalhasDetail falhas={result.falhas.map((f) => ({ nome: `#${f.rhm} (${f.projeto})`, motivo: f.motivo }))} />
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Render: preview de projetos ──────────────────────────────────────────

  if (showProjetoPreview) {
    return (
      <div className="flex flex-col min-h-0 bg-background">

        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-card sticky top-0 z-20">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-sm">
              <button
                onClick={cancelProjetoPreview}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Importar Projetos</span>
              </button>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-semibold text-foreground">Prévia da Importação</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {projetoPreviewRows.length} projetos detectados · contrato selecionado
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 px-4 text-sm rounded-lg" onClick={cancelProjetoPreview} disabled={loading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 px-4 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white font-semibold"
              onClick={handleConfirmarProjetos}
              disabled={loading || projetoCounts.novos === 0}
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Importando…</>
                : `✓  Importar Novos (${projetoCounts.novos})`
              }
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 pt-5 pb-4">
          <SummaryCard count={projetoCounts.novos}      label="Novos"         sub="projetos a criar"  accentColor="bg-violet-500"          cardCls="bg-violet-500/5 border-violet-500/20"      valueCls="text-violet-600 dark:text-violet-400"       subCls="text-violet-600/60 dark:text-violet-400/60" />
          <SummaryCard count={projetoCounts.existentes} label="Já existentes" sub="serão ignorados"  accentColor="bg-muted-foreground/30" cardCls="bg-muted/50 border-border"                  valueCls="text-muted-foreground"                     subCls="text-muted-foreground/60" />
          <SummaryCard count={projetoCounts.erros}      label="Erros"          sub="linhas inválidas" accentColor="bg-destructive"         cardCls="bg-destructive/5 border-destructive/20"   valueCls="text-destructive"                          subCls="text-destructive/60" />
        </div>

        <div className="flex items-center gap-3 px-6 pb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={projetoSearch}
              onChange={(e) => { setProjetoSearch(e.target.value); setProjetoPagina(1); }}
              placeholder="Buscar nome do projeto…"
              className="pl-8 h-8 text-sm rounded-lg bg-muted/40 border-border focus-visible:ring-violet-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {PROJETO_FILTER_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setProjetoFilter(key); setProjetoPagina(1); }}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                  projetoFilter === key
                    ? "bg-violet-600 text-white border-violet-600 dark:bg-violet-500 dark:border-violet-500"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
            Exibindo <strong>{projetoRowsDisplay.length}</strong> de <strong>{projetoPreviewRows.length}</strong>
          </span>
        </div>

        <div className="flex-1 overflow-x-auto border-t border-border">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/60 border-b border-border hover:bg-muted/60">
                <TableHead className="w-[60px] pl-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3">Linha</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</TableHead>
                <TableHead className="w-[160px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Código</TableHead>
                <TableHead className="w-[120px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Módulo</TableHead>
                <TableHead className="w-[120px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Redmine ID</TableHead>
                <TableHead className="w-[130px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Áção</TableHead>
                <TableHead className="w-[120px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetoPagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-sm text-muted-foreground">
                    Nenhum projeto encontrado para os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
              {projetoPagedRows.map((row, i) => {
                const acfg    = PROJETO_ACAO_CONFIG[row.acao];
                const progMap = projetoProgressMap.get(row.linha);
                const isErr   = row.acao === "erro_validacao";
                return (
                  <TableRow
                    key={row.linha}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      i % 2 === 1 && "bg-muted/20",
                      isErr && "opacity-60",
                      row.acao === "novo" && !isErr && "border-l-2 border-l-violet-400",
                    )}
                  >
                    <TableCell className="pl-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted border border-border font-mono text-[11px] font-semibold text-muted-foreground">
                        {row.linha}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <p className="text-sm font-medium text-foreground leading-tight" title={row.nome}>{row.nome}</p>
                      {row.motivoErro && (
                        <p className="text-[11px] text-destructive mt-0.5 flex items-center gap-1">
                          <XCircle className="h-3 w-3 shrink-0" />{row.motivoErro}
                        </p>
                      )}
                      {row.descricao && !row.motivoErro && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={row.descricao}>{row.descricao}</p>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {row.code
                        ? <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
                        : <span className="text-xs text-muted-foreground/40 italic">—</span>}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="text-xs text-muted-foreground">{MODULE_LABELS[row.moduleType] ?? row.moduleType}</span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      {row.redmineId
                        ? <span className="font-mono text-xs text-muted-foreground">{row.redmineId}</span>
                        : <span className="text-xs text-muted-foreground/40 italic">—</span>}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full border font-medium", acfg.pill)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", acfg.dot)} />
                        {acfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5 pr-5">
                      {progMap === "importando" && <span className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 font-medium"><Loader2 className="h-3.5 w-3.5 animate-spin" />Importando…</span>}
                      {progMap === "importado"  && <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />Criado</span>}
                      {progMap === "ignorado"   && <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium"><MinusCircle className="h-3.5 w-3.5" />Ignorado</span>}
                      {progMap === "erro"       && <span className="flex items-center gap-1.5 text-xs text-destructive font-medium"><XCircle className="h-3.5 w-3.5" />Erro</span>}
                      {!progMap && <span className="text-xs text-muted-foreground">Pendente</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {projetoRowsDisplay.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-border bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Mostrando <strong>{(projetoSafePage - 1) * PROJETO_PAGE_SIZE + 1}–{Math.min(projetoSafePage * PROJETO_PAGE_SIZE, projetoRowsDisplay.length)}</strong> de <strong>{projetoRowsDisplay.length}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setProjetoPagina((p) => Math.max(1, p - 1))} disabled={projetoSafePage <= 1} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Anterior
              </button>
              <span className="text-xs text-muted-foreground px-2">{projetoSafePage} / {projetoTotalPages}</span>
              <button onClick={() => setProjetoPagina((p) => Math.min(projetoTotalPages, p + 1))} disabled={projetoSafePage >= projetoTotalPages} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {projetoCounts.erros > 0 && (
          <div className="mx-6 mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              <strong>{projetoCounts.erros} linha(s)</strong> com erro de validação serão ignoradas na importação.
              Corrija o arquivo e reimporte para incluí-las.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: tela projetos ─────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto pt-6 space-y-6">

      <div className="flex items-center gap-3">
        <button
          onClick={() => { setMode(null); setProjetoResult(null); setProjetoContractId(""); setProjetoArquivoErro(null); }}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Importar Projetos</h2>
          <p className="text-sm text-muted-foreground">
            Grava em <code className="text-xs bg-muted px-1 rounded">public.projects</code> — contrato obrigatório
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contract-select" className="text-sm font-medium">
          Contrato <span className="text-destructive">*</span>
        </Label>
        <Select
          value={projetoContractId}
          onValueChange={(v) => { setProjetoContractId(v); setProjetoArquivoErro(null); }}
        >
          <SelectTrigger id="contract-select" className="w-full">
            <SelectValue placeholder="Selecione o contrato dos projetos..." />
          </SelectTrigger>
          <SelectContent>
            {contracts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!projetoContractId && (
          <p className="text-xs text-muted-foreground">Selecione o contrato antes de fazer o upload do arquivo.</p>
        )}
      </div>

      <label
        className={cn(
          "flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed transition-all",
          projetoContractId
            ? "border-border hover:border-violet-400 dark:hover:border-violet-500 bg-muted/30 hover:bg-violet-500/5 cursor-pointer group"
            : "border-border/40 bg-muted/10 opacity-50 cursor-not-allowed",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileProjetos}
          disabled={!projetoContractId || loading}
        />
        {loading ? (
          <>
            <Loader2 className="h-10 w-10 mb-3 text-violet-500 animate-spin" />
            <p className="text-sm font-medium text-foreground">Processando arquivo…</p>
          </>
        ) : (
          <>
            <Upload className={cn("h-10 w-10 mb-3 transition-colors", projetoContractId ? "text-muted-foreground/50 group-hover:text-violet-500" : "text-muted-foreground/30")} />
            <p className="text-sm font-medium text-foreground">Clique ou arraste o arquivo aqui</p>
            <p className="text-xs text-muted-foreground mt-1">.csv ou .xlsx com colunas: Nome, Descrição, Código, Redmine ID, Módulo</p>
          </>
        )}
      </label>

      {projetoArquivoErro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">Arquivo inválido ou fora do padrão</p>
          </div>
          <p className="text-xs text-destructive/80 leading-relaxed">{projetoArquivoErro}</p>
          <div className="pt-1 border-t border-destructive/20">
            <p className="text-[11px] text-destructive/60">
              Formato esperado: colunas <strong>Nome</strong>, Descrição, Código, Redmine ID, Módulo — .csv (separador ;) ou .xlsx
            </p>
          </div>
        </div>
      )}

      {projetoResult && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">Importação concluída</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ResultCard count={projetoResult.importados} label="Importados"    color="violet" />
            <ResultCard count={projetoResult.existentes} label="Já existentes" color="gray" />
            <ResultCard count={projetoResult.erros}      label="Erros"          color="red" />
          </div>
          {projetoResult.falhas.length > 0 && (
            <FalhasDetail falhas={projetoResult.falhas} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── SummaryCard ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  count: number; label: string; sub: string;
  accentColor: string; cardCls: string; valueCls: string; subCls: string;
}
function SummaryCard({ count, label, sub, accentColor, cardCls, valueCls, subCls }: SummaryCardProps) {
  return (
    <div className={cn("relative h-24 rounded-xl border flex flex-col justify-center pl-7 pr-4 overflow-hidden", cardCls)}>
      <span className={cn("absolute left-0 inset-y-0 w-1 rounded-l-xl", accentColor)} />
      <p className={cn("text-3xl font-bold leading-none tabular-nums", valueCls)}>{count}</p>
      <p className="text-[12px] font-semibold text-foreground mt-2 leading-tight">{label}</p>
      <p className={cn("text-[10px] mt-0.5 leading-tight", subCls)}>{sub}</p>
    </div>
  );
}

// ─── ResultCard ─────────────────────────────────────────────────────────────

function ResultCard({ count, label, color }: { count: number; label: string; color: string }) {
  const cls = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    sky:     "bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400",
    violet:  "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-400",
    gray:    "bg-muted border-border text-muted-foreground",
    red:     "bg-destructive/10 border-destructive/20 text-destructive",
  }[color] ?? "bg-muted border-border text-muted-foreground";
  return (
    <div className={cn("rounded-lg border p-3 text-center", cls)}>
      <p className="text-2xl font-bold tabular-nums">{count}</p>
      <p className="text-[11px] mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

// ─── FalhasDetail ────────────────────────────────────────────────────────────

function FalhasDetail({ falhas }: { falhas: { nome: string; motivo: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
      >
        <XCircle className="h-3.5 w-3.5" />
        {falhas.length} falha(s) — clique para {expanded ? "ocultar" : "ver detalhes"}
      </button>
      {expanded && (
        <ul className="space-y-0.5 max-h-32 overflow-y-auto pl-1">
          {falhas.map((f, i) => (
            <li key={i} className="text-xs text-destructive/80"><strong>{f.nome}</strong>: {f.motivo}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

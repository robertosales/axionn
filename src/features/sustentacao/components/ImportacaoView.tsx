import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  FolderKanban, ArrowLeft, XCircle, AlertTriangle, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { upsertDemandas } from "../services/demandas.service";
import { upsertProjetos } from "../services/projetos.service";
import { TIPOS_DEMANDA_IMR, calcPrazoInicio, calcPrazoSolucao } from "../types/imr";
import { useProjetos } from "../hooks/useProjetos";
import { parse, isValid, format } from "date-fns";
import {
  ImportacaoPreviewTable,
  type PreviewRow,
  type RowStatus,
} from "./ImportacaoPreviewTable";
import { cn } from "@/lib/utils";

// ─── SheetJS CDN loader (sem npm install) ──────────────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    XLSX: any;
  }
}
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
  fila_atendimento: "fila_atendimento",
  planejamento_elaboracao: "planejamento_elaboracao",
  planejamento_ag_aprovacao: "planejamento_ag_aprovacao",
  planejamento_aprovada: "planejamento_aprovada",
  em_execucao: "em_execucao",
  bloqueada: "bloqueada",
  hom_ag_homologacao: "hom_ag_homologacao",
  hom_homologada: "hom_homologada",
  rejeitada: "rejeitada",
  fila_producao: "fila_producao",
  ag_aceite_final: "ag_aceite_final",
  cancelada: "cancelada",
  fila_concluida: "fila_concluida",
  "fila de atendimento": "fila_atendimento",
  nova: "fila_atendimento",
  "planejamento: em elaboracao": "planejamento_elaboracao",
  "planejamento: em elaboração": "planejamento_elaboracao",
  "planejamento: ag. aprovacao": "planejamento_ag_aprovacao",
  "planejamento: ag. aprovação": "planejamento_ag_aprovacao",
  "planejamento: aprovada p/ exec": "planejamento_aprovada",
  "em execucao": "em_execucao",
  "em execução": "em_execucao",
  "hom: ag. homologacao": "hom_ag_homologacao",
  "hom: ag. homologação": "hom_ag_homologacao",
  "hom: homologada": "hom_homologada",
  homologada: "hom_homologada",
  "fila para producao (infra)": "fila_producao",
  "fila para produção (infra)": "fila_producao",
  "ag. aceite final": "ag_aceite_final",
  "aguardando aceite final": "ag_aceite_final",
  concluida: "fila_concluida",
  "concluída": "fila_concluida",
  "fila concluida": "fila_concluida",
  "fila concluída": "fila_concluida",
  "fila de concluidas": "fila_concluida",
  "fila de concluídas": "fila_concluida",
  cancelado: "cancelada",
  bloqueado: "bloqueada",
  rejeitado: "rejeitada",
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

function normalizeSLA(raw: string): string | null {
  if (!raw || raw === "-") return null;
  if (/\d+\s*x\s*7/i.test(raw)) return "continuo";
  if (normalize(raw) === "padrao" || normalize(raw) === "padrão") return "padrao";
  return raw.trim();
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

// ─── Componente principal ───────────────────────────────────────────────────

export function ImportacaoView() {
  const { currentTeamId } = useAuth();
  const { projetos, reload: reloadProjetos } = useProjetos({ allTeams: true });

  // Pré-carrega o SheetJS em background para uploads .xlsx mais rápidos
  useEffect(() => { loadXLSX().catch(() => {}); }, []);

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
  const [projetoResult, setProjetoResult] = useState<{
    importados: number; existentes: number; erros: number;
  } | null>(null);

  const inputRef   = useRef<HTMLInputElement>(null);
  const projetoMap = new Map(
    projetos.map((p) => [normalize(p.nome), { nome: p.nome, teamId: p.team_id }]),
  );

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function parseCsvToRows(buffer: ArrayBuffer): Record<string, string>[] {
    const text  = new TextDecoder("utf-8").decode(buffer);
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim());
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
    setShowPreview(false);
    setValidRows([]);
    setErrors([]);
    setAutoCreatedTypes([]);
    setProgressMap(new Map());
  }

  // ─── Upload demandas ─────────────────────────────────────────────────────

  const handleFileDemandas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeamId) return;
    setResult(null); setShowPreview(false); setErrors([]); setValidRows([]); setProgressMap(new Map());
    try {
      const buffer = await file.arrayBuffer();
      const rows   = isXlsxFile(file) ? await parseXlsxToRows(buffer) : parseCsvToRows(buffer);
      const parsed: ParsedRow[]          = [];
      const errs:   ValidationError[]    = [];
      const newTypes: string[]           = [];

      rows.forEach((r, idx) => {
        const linha       = idx + 2;
        const rhm         = String(r["#"] || r["RHM"] || r["rhm"] || "").trim();
        const projeto      = String(r["Projeto"] || r["projeto"] || "").trim();
        const tipoRaw      = String(r["Tipo"] || r["tipo"] || "").trim();
        const dataInicioRaw =
          r["Criado em"] || r["Criado Em"] || r["Data de Início"] ||
          r["Data de Inicio"] || r["data_inicio"] || null;
        const descricao =
          String(r["Título"] || r["Titulo"] || r["Subject"] || r["Descrição"] || r["descricao"] || "").trim() ||
          undefined;

        if (!rhm)    { errs.push({ linha, mensagem: "# não informado." }); return; }
        if (!projeto) { errs.push({ linha, mensagem: "Projeto não informado." }); return; }
        const projetoInfo = projetoMap.get(normalize(projeto));
        if (!projetoInfo) { errs.push({ linha, mensagem: `Projeto '${projeto}' não encontrado.` }); return; }
        if (!tipoRaw) { errs.push({ linha, mensagem: "Tipo não informado." }); return; }
        const tipoResult = normalizeTipo(tipoRaw);
        if (!tipoResult) { errs.push({ linha, mensagem: `Tipo '${tipoRaw}' não reconhecido.` }); return; }
        if (tipoResult.autoCreated && !newTypes.includes(tipoRaw)) newTypes.push(tipoRaw);
        const tipoNorm = tipoResult.value;
        if (!dataInicioRaw) { errs.push({ linha, mensagem: "Criado em inválido ou ausente." }); return; }
        const dataInicio = parseDataInicio(dataInicioRaw);
        if (!dataInicio)    { errs.push({ linha, mensagem: "Criado em inválido ou ausente." }); return; }

        const situacaoRaw  = String(r["Situação"] || r["Situacao"] || r["situacao"] || "Nova").trim();
        const situacaoLimpa = removeEmojis(situacaoRaw);
        const situacao = normalizeSituacao(situacaoLimpa);
        if (!situacao) {
          errs.push({ linha, mensagem: `Situação '${situacaoRaw}' não reconhecida. Use uma situação válida do cadastro.` });
          return;
        }
        const isCorretiva  = tipoNorm === "manutencao_corretiva";
        let sla            = "padrao";
        const regimeRaw    = String(r["Regime de Atendimento"] || r["Regime"] || r["regime"] || "").trim();
        if (isCorretiva && /\d+\s*x\s*7/i.test(regimeRaw)) sla = "continuo";
        else if (isCorretiva && (normalize(regimeRaw) === "continuo" || normalize(regimeRaw) === "contínuo")) sla = "continuo";

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
          rhm, projeto: projetoInfo.nome, teamId: projetoInfo.teamId, tipo: tipoNorm,
          data_inicio: dataInicio, situacao, sla, tipo_defeito, originada_diagnostico, descricao,
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

  // ─── Upload projetos ─────────────────────────────────────────────────────

  const handleFileProjetos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeamId) return;
    setProjetoResult(null); setLoading(true);
    try {
      const buffer  = await file.arrayBuffer();
      const rows    = isXlsxFile(file) ? await parseXlsxToRows(buffer) : parseCsvToRows(buffer);
      const results = { importados: 0, existentes: 0, erros: 0 };
      const existingNorms = new Set(projetos.map((p) => normalize(p.nome)));
      for (const r of rows) {
        const nome = String(r["Nome"] || r["nome"] || "").trim();
        if (!nome) { results.erros++; continue; }
        if (existingNorms.has(normalize(nome))) { results.existentes++; continue; }
        const descricao = String(r["Descrição"] || r["Descricao"] || r["descricao"] || "").trim();
        const equipe    = String(r["Equipe"]   || r["equipe"]   || "").trim();
        const slaRaw    = String(r["SLA"]      || r["sla"]      || "").trim();
        const sla       = normalizeSLA(slaRaw) || "padrao";
        try {
          await upsertProjetos(currentTeamId, [{ nome, descricao, equipe, sla }]);
          results.importados++;
          existingNorms.add(normalize(nome));
        } catch { results.erros++; }
      }
      setProjetoResult(results);
      toast.success(`Concluída: ${results.importados} novos, ${results.existentes} já existentes`);
      await reloadProjetos();
    } catch { toast.error("Erro ao processar arquivo."); }
    finally  { setLoading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  // ─── Migração ─────────────────────────────────────────────────────────────

  const handleImport = async (selectedRows: PreviewRow[]) => {
    if (!currentTeamId || selectedRows.length === 0) return;
    setLoading(true);
    setProgressMap(new Map(selectedRows.map((r) => [r.rhm, "atualizando" as RowStatus])));

    const existsInDb   = new Set<string>();
    const byTeamCheck  = new Map<string, string[]>();
    for (const row of selectedRows) {
      const list = byTeamCheck.get(row.teamId) ?? [];
      list.push(row.rhm); byTeamCheck.set(row.teamId, list);
    }
    const { supabase } = await import("@/integrations/supabase/client");
    for (const [teamId, rhms] of byTeamCheck) {
      const { data } = await supabase
        .from("demandas" as any).select("rhm")
        .eq("team_id", teamId).in("rhm", rhms);
      if (data) for (const d of data as any[]) existsInDb.add(`${teamId}:${d.rhm}`);
    }

    const totals = { importados: 0, atualizados: 0, erros: 0 };
    const falhas: FailedRow[] = [];
    const byTeam = new Map<string, PreviewRow[]>();
    for (const row of selectedRows) {
      const group = byTeam.get(row.teamId) ?? [];
      group.push(row); byTeam.set(row.teamId, group);
    }
    for (const [teamId, rows] of byTeam) {
      try {
        const res = await upsertDemandas(teamId, rows.map((row) => ({
          rhm:                        row.rhm,
          projeto:                    row.projeto,
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
        if (res.falhas && res.falhas.length > 0) {
          for (const f of res.falhas) {
            falhas.push({ rhm: f.rhm, projeto: f.projeto, motivo: f.motivo });
          }
          setProgressMap((prev) => {
            const next = new Map(prev);
            for (const f of res.falhas!) next.set(f.rhm, "erro");
            return next;
          });
        }
        setProgressMap((prev) => {
          const next = new Map(prev);
          for (const row of rows) {
            const key = `${teamId}:${row.rhm}`;
            if (next.get(row.rhm) !== "erro") {
              next.set(row.rhm, existsInDb.has(key) ? "atualizado" : "criado");
            }
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
    const tipoMsg = autoCreatedTypes.length > 0
      ? ` | ${autoCreatedTypes.length} tipo(s) criado(s) automaticamente` : "";
    toast.success(`Importação concluída: ${totals.importados} novos, ${totals.atualizados} atualizados${tipoMsg}`);
    setResult({ ...totals, tiposCriados: autoCreatedTypes, falhas });
    setShowPreview(false); setLoading(false);
  };

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

  // ─── Render: tela principal ───────────────────────────────────────────────

  const isDemandas = mode === "demandas";

  return (
    <div className="w-full max-w-5xl space-y-4">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setMode(null); setResult(null); setProjetoResult(null); cancelPreview(); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <span className="text-border select-none">/</span>
        <span className="text-sm font-medium text-foreground">
          {isDemandas ? "Importar Demandas (Redmine)" : "Importar Projetos"}
        </span>
      </div>

      {/* Card principal */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">

        {/* ── HEADER ── */}
        <div className={cn(
          "px-8 py-6 border-b border-border",
          isDemandas
            ? "bg-gradient-to-r from-blue-500/5 dark:from-blue-500/10 to-transparent"
            : "bg-gradient-to-r from-violet-500/5 dark:from-violet-500/10 to-transparent",
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              isDemandas ? "bg-blue-500/10 dark:bg-blue-500/15" : "bg-violet-500/10 dark:bg-violet-500/15",
            )}>
              {isDemandas
                ? <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                : <FolderKanban    className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              }
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">
                {isDemandas ? "Importar Demandas (Redmine)" : "Importar Projetos de Sustentação"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isDemandas
                  ? "Faça upload do arquivo .csv ou .xlsx exportado do Redmine para revisar e migrar as demandas."
                  : "Faça upload do arquivo .csv ou .xlsx com os projetos de sustentação a serem cadastrados."
                }
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {isDemandas ? (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="text-xs font-semibold text-foreground/70 shrink-0">Obrigatórias:</span>
                  {["#", "Projeto", "Tipo", "Criado em"].map((col) => (
                    <code key={col} className="text-[11px] bg-background border border-border text-foreground/80 px-2 py-0.5 rounded font-mono shadow-sm">{col}</code>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">Opcionais:</span>
                  {["Título", "Situação", "Regime de Atendimento", "Defeito Impeditivo"].map((col) => (
                    <code key={col} className="text-[11px] bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded font-mono">{col}</code>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="text-xs font-semibold text-foreground/70 shrink-0">Colunas:</span>
                  {["Nome", "Descrição", "Equipe", "SLA"].map((col) => (
                    <code key={col} className="text-[11px] bg-background border border-border text-foreground/80 px-2 py-0.5 rounded font-mono shadow-sm">{col}</code>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-lg px-3 py-1.5 w-fit">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Projetos já cadastrados serão ignorados automaticamente
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── CORPO: dropzone / erros / resultados ── */}
        {!showPreview && (
          <div className="p-8 space-y-5">
            <label className={cn(
              "relative flex flex-col items-center justify-center gap-4",
              "min-h-[180px] rounded-xl cursor-pointer",
              "border-2 border-dashed border-border bg-muted/30",
              "hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-500/5 transition-all duration-200 group",
            )}>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={isDemandas ? handleFileDemandas : handleFileProjetos}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                disabled={loading}
              />
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-colors",
                isDemandas
                  ? "bg-blue-500/10 dark:bg-blue-500/15 group-hover:bg-blue-500/20"
                  : "bg-violet-500/10 dark:bg-violet-500/15 group-hover:bg-violet-500/20",
              )}>
                <Upload className={cn("h-5 w-5", isDemandas ? "text-blue-500" : "text-violet-500")} />
              </div>
              <div className="text-center pointer-events-none space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {loading ? "Processando arquivo…" : "Arraste o arquivo aqui"}
                </p>
                <p className="text-xs text-muted-foreground">ou clique para selecionar um arquivo .csv ou .xlsx</p>
              </div>
              {!loading && (
                <span className={cn(
                  "text-xs font-medium px-4 py-1.5 rounded-full pointer-events-none",
                  isDemandas
                    ? "bg-blue-600 dark:bg-blue-500 text-white group-hover:bg-blue-700 dark:group-hover:bg-blue-600"
                    : "bg-violet-600 dark:bg-violet-500 text-white group-hover:bg-violet-700 dark:group-hover:bg-violet-600",
                )}>
                  Selecionar Arquivo
                </span>
              )}
            </label>

            {isDemandas && errors.length > 0 && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 dark:bg-destructive/10 p-4 space-y-2 max-h-44 overflow-y-auto">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Linhas rejeitadas</p>
                {errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>Linha {err.linha}: {err.mensagem}</span>
                  </div>
                ))}
              </div>
            )}

            {isDemandas && autoCreatedTypes.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/15 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Tipos criados automaticamente</p>
                <ul className="list-disc pl-5 text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                  {autoCreatedTypes.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}

            {isDemandas && result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-semibold text-foreground text-sm">Importação concluída</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <ResultCard value={result.importados}  label="Criados"     colorClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" />
                  <ResultCard value={result.atualizados} label="Atualizados" colorClass="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20" />
                  <ResultCard value={result.erros}       label="Erros"       colorClass="bg-destructive/10 text-destructive border-destructive/20" />
                </div>
                {result.tiposCriados && result.tiposCriados.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/15 p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Tipos criados automaticamente ({result.tiposCriados.length}):</p>
                    <ul className="list-disc pl-5 text-xs text-amber-600 dark:text-amber-400 mt-1 space-y-0.5">
                      {result.tiposCriados.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
                {result.falhas && result.falhas.length > 0 && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 dark:bg-destructive/10 p-3 space-y-2">
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5" />
                      Falhas na migração ({result.falhas.length})
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {result.falhas.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="font-mono font-bold text-destructive shrink-0">#{f.rhm}</span>
                          <span className="text-muted-foreground shrink-0">{f.projeto}</span>
                          <span className="text-destructive ml-auto truncate" title={f.motivo}>{f.motivo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  variant="outline" size="sm" className="rounded-xl"
                  onClick={() => { setResult(null); setProgressMap(new Map()); }}
                >
                  Importar outro arquivo
                </Button>
              </div>
            )}

            {!isDemandas && projetoResult && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-semibold text-foreground text-sm">Importação concluída</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <ResultCard value={projetoResult.importados} label="Importados"    colorClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" />
                  <ResultCard value={projetoResult.existentes} label="Já existentes" colorClass="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20" />
                  <ResultCard value={projetoResult.erros}      label="Erros"         colorClass="bg-destructive/10 text-destructive border-destructive/20" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PREVIEW TABLE ── */}
        {isDemandas && showPreview && (
          <ImportacaoPreviewTable
            rows={validRows}
            onConfirm={handleImport}
            onCancel={cancelPreview}
            loading={loading}
            progressMap={progressMap}
          />
        )}

      </div>
    </div>
  );
}

// ─── ResultCard ─────────────────────────────────────────────────────────────

function ResultCard({ value, label, colorClass }: { value: number; label: string; colorClass: string }) {
  return (
    <div className={cn("text-center h-24 flex flex-col items-center justify-center rounded-xl border", colorClass)}>
      <p className="text-3xl font-bold leading-none tabular-nums">{value}</p>
      <p className="text-xs font-medium mt-2 opacity-75">{label}</p>
    </div>
  );
}

export default ImportacaoView;

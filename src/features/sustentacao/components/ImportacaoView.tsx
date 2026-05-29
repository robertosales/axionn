import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  FolderKanban, ArrowLeft, XCircle, AlertTriangle,
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

// ─── Mapas de normalização ───────────────────────────────────────────────────

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
};

function normalizeSituacao(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SITUACAO_MAP[cleaned] || SITUACAO_MAP[raw.trim().toLowerCase()] || "fila_atendimento";
}

const VALID_TIPOS_MAP: Record<string, string> = {};
TIPOS_DEMANDA_IMR.forEach((t) => {
  VALID_TIPOS_MAP[t.label.toLowerCase()] = t.value;
  VALID_TIPOS_MAP[t.value] = t.value;
});

function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function removeEmojis(str: string): string {
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}]/gu,
      "",
    )
    .trim();
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

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface ValidationError {
  linha: number;
  mensagem: string;
}

interface ParsedRow extends PreviewRow {
  data_inicio: Date;
}

type ImportMode = null | "demandas" | "projetos";

interface FailedRow {
  rhm: string;
  projeto: string;
  motivo: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ImportacaoView() {
  const { currentTeamId } = useAuth();
  const { projetos, reload: reloadProjetos } = useProjetos({ allTeams: true });

  const [mode, setMode] = useState<ImportMode>(null);
  const [loading, setLoading] = useState(false);

  const [validRows, setValidRows]               = useState<ParsedRow[]>([]);
  const [autoCreatedTypes, setAutoCreatedTypes] = useState<string[]>([]);
  const [errors, setErrors]                     = useState<ValidationError[]>([]);
  const [showPreview, setShowPreview]           = useState(false);
  const [progressMap, setProgressMap]           = useState<Map<string, RowStatus>>(new Map());
  const [result, setResult] = useState<{
    importados: number;
    atualizados: number;
    erros: number;
    tiposCriados?: string[];
    falhas?: FailedRow[];
  } | null>(null);

  const [projetoResult, setProjetoResult] = useState<{
    importados: number;
    existentes: number;
    erros: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const projetoMap = new Map(
    projetos.map((p) => [normalize(p.nome), { nome: p.nome, teamId: p.team_id }]),
  );

  // ─── Parse do CSV ─────────────────────────────────────────────────────────

  function parseCsvToRows(buffer: ArrayBuffer): Record<string, string>[] {
    const text = new TextDecoder("utf-8").decode(buffer);
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

  // ─── Upload: demandas ──────────────────────────────────────────────────────

  const handleFileDemandas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeamId) return;

    setResult(null);
    setShowPreview(false);
    setErrors([]);
    setValidRows([]);
    setProgressMap(new Map());

    try {
      const buffer = await file.arrayBuffer();
      const rows = parseCsvToRows(buffer);

      const parsed: ParsedRow[] = [];
      const errs: ValidationError[] = [];
      const newTypes: string[] = [];

      rows.forEach((r, idx) => {
        const linha = idx + 2;

        const rhm     = String(r["#"] || r["RHM"] || r["rhm"] || "").trim();
        const projeto  = String(r["Projeto"] || r["projeto"] || "").trim();
        const tipoRaw  = String(r["Tipo"] || r["tipo"] || "").trim();
        const dataInicioRaw =
          r["Criado em"] || r["Criado Em"] || r["Data de Início"] || r["Data de Inicio"] || r["data_inicio"] || null;
        const descricao =
          String(r["Título"] || r["Titulo"] || r["Subject"] || r["Descrição"] || r["descricao"] || "").trim() ||
          undefined;

        if (!rhm)     { errs.push({ linha, mensagem: "# não informado." }); return; }
        if (!projeto)  { errs.push({ linha, mensagem: "Projeto não informado." }); return; }

        const projetoInfo = projetoMap.get(normalize(projeto));
        if (!projetoInfo) {
          errs.push({ linha, mensagem: `Projeto '${projeto}' não encontrado. Verifique o cadastro.` });
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

        const situacaoRaw = String(r["Situação"] || r["Situacao"] || r["situacao"] || "Nova").trim();
        const situacao = normalizeSituacao(removeEmojis(situacaoRaw));

        const isCorretiva = tipoNorm === "manutencao_corretiva";
        let sla = "padrao";
        const regimeRaw = String(r["Regime de Atendimento"] || r["Regime"] || r["regime"] || "").trim();
        if (isCorretiva && /\d+\s*x\s*7/i.test(regimeRaw)) sla = "continuo";
        else if (isCorretiva && (normalize(regimeRaw) === "continuo" || normalize(regimeRaw) === "contínuo"))
          sla = "continuo";

        let tipo_defeito: string | undefined;
        const defeitoRaw = String(r["Defeito Impeditivo"] || r["Tipo de Defeito"] || r["tipo_defeito"] || "")
          .trim().toLowerCase();
        if (isCorretiva && defeitoRaw) {
          tipo_defeito = defeitoRaw === "sim" || defeitoRaw === "impeditivo" ? "impeditivo" : "nao_impeditivo";
        } else if (isCorretiva) {
          tipo_defeito = "impeditivo";
        }

        let originada_diagnostico = false;
        const diagRaw = String(r["Originada de Diagnóstico"] || r["Originada de Diagnostico"] || "")
          .trim().toLowerCase();
        if (isCorretiva && (diagRaw === "sim" || diagRaw === "true" || diagRaw === "1"))
          originada_diagnostico = true;

        const regime = isCorretiva ? sla : undefined;
        const defeito = isCorretiva ? tipo_defeito : undefined;
        const prazoInicio  = calcPrazoInicio(dataInicio, tipoNorm, regime, defeito);
        const prazoSolucao = calcPrazoSolucao(dataInicio, tipoNorm, regime, defeito);

        const prevEncRaw = r["Data de Previsão de Encerramento"] || r["Data Previsão Encerramento"] || null;
        let prevEnc: string | undefined;
        if (prevEncRaw) {
          const d = parseDataInicio(prevEncRaw);
          if (d) prevEnc = format(d, "yyyy-MM-dd");
        }

        parsed.push({
          rhm,
          projeto: projetoInfo.nome,
          teamId: projetoInfo.teamId,
          tipo: tipoNorm,
          data_inicio: dataInicio,
          situacao,
          sla,
          tipo_defeito,
          originada_diagnostico,
          descricao,
          data_previsao_encerramento:
            prevEnc || (prazoSolucao ? format(prazoSolucao, "yyyy-MM-dd") : undefined),
          prazo_inicio_atendimento: prazoInicio?.toISOString(),
          prazo_solucao: prazoSolucao?.toISOString(),
        });
      });

      setValidRows(parsed);
      setErrors(errs);
      setAutoCreatedTypes(newTypes);
      if (parsed.length === 0 && errs.length === 0) {
        toast.error("Nenhuma linha encontrada no arquivo.");
      } else {
        setShowPreview(true);
      }
    } catch {
      toast.error("Erro ao processar arquivo.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // ─── Upload: projetos ──────────────────────────────────────────────────────

  const handleFileProjetos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeamId) return;

    setProjetoResult(null);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const rows = parseCsvToRows(buffer);

      const results = { importados: 0, existentes: 0, erros: 0 };
      const existingNorms = new Set(projetos.map((p) => normalize(p.nome)));

      for (const r of rows) {
        const nome = String(r["Nome"] || r["nome"] || "").trim();
        if (!nome) { results.erros++; continue; }
        if (existingNorms.has(normalize(nome))) { results.existentes++; continue; }

        const descricao = String(r["Descrição"] || r["Descricao"] || r["descricao"] || "").trim();
        const equipe    = String(r["Equipe"] || r["equipe"] || "").trim();
        const slaRaw    = String(r["SLA"] || r["sla"] || "").trim();
        const sla       = normalizeSLA(slaRaw) || "padrao";

        try {
          await upsertProjetos(currentTeamId, [{ nome, descricao, equipe, sla }]);
          results.importados++;
          existingNorms.add(normalize(nome));
        } catch {
          results.erros++;
        }
      }

      setProjetoResult(results);
      toast.success(
        `Importação de projetos concluída: ${results.importados} novos, ${results.existentes} já existentes`,
      );
      await reloadProjetos();
    } catch {
      toast.error("Erro ao processar arquivo.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // ─── Migração ─────────────────────────────────────────────────────────────

  const handleImport = async (selectedRows: PreviewRow[]) => {
    if (!currentTeamId || selectedRows.length === 0) return;
    setLoading(true);

    setProgressMap(new Map(selectedRows.map((r) => [r.rhm, "atualizando" as RowStatus])));

    const existsInDb = new Set<string>();
    const byTeamCheck = new Map<string, string[]>();
    for (const row of selectedRows) {
      const list = byTeamCheck.get(row.teamId) ?? [];
      list.push(row.rhm);
      byTeamCheck.set(row.teamId, list);
    }
    const { supabase } = await import("@/integrations/supabase/client");
    for (const [teamId, rhms] of byTeamCheck) {
      const { data } = await supabase
        .from("demandas" as any)
        .select("rhm")
        .eq("team_id", teamId)
        .in("rhm", rhms);
      if (data) {
        for (const d of data as any[]) {
          existsInDb.add(`${teamId}:${d.rhm}`);
        }
      }
    }

    const totals = { importados: 0, atualizados: 0, erros: 0 };
    const falhas: FailedRow[] = [];

    const byTeam = new Map<string, PreviewRow[]>();
    for (const row of selectedRows) {
      const group = byTeam.get(row.teamId) ?? [];
      group.push(row);
      byTeam.set(row.teamId, group);
    }

    for (const [teamId, rows] of byTeam) {
      try {
        const res = await upsertDemandas(
          teamId,
          rows.map((row) => ({
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
          })),
        );

        totals.importados  += res.importados;
        totals.atualizados += res.atualizados;
        totals.erros       += res.erros;

        setProgressMap((prev) => {
          const next = new Map(prev);
          for (const row of rows) {
            const key = `${teamId}:${row.rhm}`;
            next.set(row.rhm, existsInDb.has(key) ? "atualizado" : "criado");
          }
          return next;
        });
      } catch (err: any) {
        totals.erros += rows.length;
        const motivo = err?.message ?? "Erro desconhecido";
        setProgressMap((prev) => {
          const next = new Map(prev);
          for (const row of rows) next.set(row.rhm, "erro");
          return next;
        });
        for (const row of rows) {
          falhas.push({ rhm: row.rhm, projeto: row.projeto, motivo });
        }
      }
    }

    const tipoMsg =
      autoCreatedTypes.length > 0
        ? ` | ${autoCreatedTypes.length} tipo(s) criado(s) automaticamente`
        : "";
    toast.success(
      `Importação concluída: ${totals.importados} novos, ${totals.atualizados} atualizados${tipoMsg}`,
    );

    setResult({ ...totals, tiposCriados: autoCreatedTypes, falhas });
    setShowPreview(false);
    setLoading(false);
  };

  function cancelPreview() {
    setShowPreview(false);
    setValidRows([]);
    setErrors([]);
    setAutoCreatedTypes([]);
    setProgressMap(new Map());
  }

  // ─── Render: tela de seleção de modo ──────────────────────────────────────

  if (mode === null) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Importação</h2>
          <p className="text-sm text-muted-foreground mt-1">Selecione o tipo de importação que deseja realizar.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-blue-300 rounded-xl"
            onClick={() => setMode("demandas")}
          >
            <CardContent className="p-7 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Demandas (Redmine)</h3>
              <p className="text-xs text-muted-foreground">
                Importar do Redmine<br />(.csv / .xlsx)
              </p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-blue-300 rounded-xl"
            onClick={() => setMode("projetos")}
          >
            <CardContent className="p-7 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mx-auto">
                <FolderKanban className="h-6 w-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Projetos</h3>
              <p className="text-xs text-muted-foreground">
                Importar sistemas<br />de sustentação (.csv / .xlsx)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Render: tela principal ───────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Voltar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMode(null);
            setResult(null);
            setProjetoResult(null);
            cancelPreview();
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>

      {/* ── Card principal ── */}
      <Card className="rounded-xl border border-gray-100 shadow-sm">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              mode === "demandas" ? "bg-blue-50" : "bg-violet-50"
            )}>
              {mode === "demandas"
                ? <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                : <FolderKanban className="h-5 w-5 text-violet-600" />
              }
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold text-gray-900">
                {mode === "demandas" ? "Importar Demandas (Redmine)" : "Importar Projetos"}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {mode === "demandas" ? (
                  <>
                    Faça upload do arquivo <span className="font-medium text-gray-700">.csv</span> exportado do Redmine.<br />
                    Colunas obrigatórias:{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">#</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Projeto</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Tipo</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Criado em</code>.<br />
                    Colunas opcionais:{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Título</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Situação</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Regime de Atendimento</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Defeito Impeditivo</code>.
                  </>
                ) : (
                  <>
                    Faça upload do arquivo <span className="font-medium text-gray-700">.csv</span> com as colunas:{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Nome</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Descrição</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">Equipe</code>{" "}
                    <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono">SLA</code>.
                  </>
                )}
              </CardDescription>
              {/* Alerta amarelo projetos */}
              {mode === "projetos" && (
                <div className="flex items-center gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Projetos já cadastrados serão ignorados</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8 space-y-5">
          {/* ── Área de upload ── */}
          {!showPreview && (
            <div
              className="border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors duration-200 rounded-xl p-10 text-center space-y-4 bg-gray-50/50"
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mx-auto">
                <Upload className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground">Suporta arquivos .csv</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                onChange={mode === "demandas" ? handleFileDemandas : handleFileProjetos}
                className="hidden"
              />
              <Button
                variant="outline"
                className="px-6 h-9 text-sm font-medium rounded-lg border-gray-200 hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-colors"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
              >
                {loading ? "Processando..." : "Selecionar Arquivo"}
              </Button>
            </div>
          )}

          {/* ── Erros de validação do CSV ── */}
          {mode === "demandas" && errors.length > 0 && (
            <div className="border border-red-200 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto bg-red-50/60">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                Linhas com erro — não serão importadas
              </p>
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Linha {err.linha}: {err.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Aviso de tipos auto-criados ── */}
          {mode === "demandas" && autoCreatedTypes.length > 0 && (
            <div className="border border-amber-200 rounded-xl p-4 space-y-1.5 bg-amber-50">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Tipos não encontrados (serão criados automaticamente):
              </p>
              <ul className="list-disc pl-5 text-xs text-amber-700 space-y-0.5">
                {autoCreatedTypes.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {/* ── Tabela comparativa de preview ── */}
          {mode === "demandas" && showPreview && (
            <ImportacaoPreviewTable
              rows={validRows}
              onConfirm={handleImport}
              onCancel={cancelPreview}
              loading={loading}
              progressMap={progressMap}
            />
          )}

          {/* ── Resultado final: demandas ── */}
          {mode === "demandas" && result && !showPreview && (
            <div className="border border-gray-100 rounded-xl p-6 space-y-4 bg-white">
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Resultado da importação
              </p>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <ResultCard value={result.importados} label="Criados" colorClass="bg-emerald-50 text-emerald-700" />
                <ResultCard value={result.atualizados} label="Atualizados" colorClass="bg-blue-50 text-blue-700" />
                <ResultCard value={result.erros} label="Erros" colorClass="bg-red-50 text-red-600" />
              </div>

              {result.tiposCriados && result.tiposCriados.length > 0 && (
                <div className="border border-amber-200 rounded-xl p-3 bg-amber-50">
                  <p className="text-xs font-semibold text-amber-800">
                    Tipos criados automaticamente ({result.tiposCriados.length}):
                  </p>
                  <ul className="list-disc pl-5 text-xs text-amber-700 mt-1 space-y-0.5">
                    {result.tiposCriados.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}

              {result.falhas && result.falhas.length > 0 && (
                <div className="border border-red-200 rounded-xl p-3 bg-red-50/60 space-y-2">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Demandas que falharam na migração ({result.falhas.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.falhas.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="font-mono font-bold text-red-700 shrink-0">#{f.rhm}</span>
                        <span className="text-muted-foreground shrink-0">{f.projeto}</span>
                        <span className="text-red-600 ml-auto truncate" title={f.motivo}>{f.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setResult(null);
                  setProgressMap(new Map());
                }}
              >
                Importar outro arquivo
              </Button>
            </div>
          )}

          {/* ── Resultado final: projetos ── */}
          {mode === "projetos" && projetoResult && (
            <>
              <div className="border-t border-gray-100 pt-5">
                <p className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Resultado da importação
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <ResultCard value={projetoResult.importados} label="Importados" colorClass="bg-emerald-50 text-emerald-700" />
                  <ResultCard value={projetoResult.existentes} label="Já existentes" colorClass="bg-blue-50 text-blue-700" />
                  <ResultCard value={projetoResult.erros} label="Erros" colorClass="bg-red-50 text-red-600" />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-componente: card de resultado ───────────────────────────────────────

function ResultCard({
  value,
  label,
  colorClass,
}: {
  value: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className={cn("text-center p-4 rounded-xl", colorClass)}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs mt-1.5 opacity-80">{label}</p>
    </div>
  );
}

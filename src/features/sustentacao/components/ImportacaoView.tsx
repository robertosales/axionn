import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, FolderKanban, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { upsertDemandas } from "../services/demandas.service";
import { upsertProjetos } from "../services/projetos.service";
import { TIPOS_DEMANDA_IMR, calcPrazoInicio, calcPrazoSolucao } from "../types/imr";
import { useProjetos } from "../hooks/useProjetos";
import { parse, isValid, format } from "date-fns";

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

interface ValidationError {
  linha: number;
  mensagem: string;
}

interface ParsedRow {
  rhm: string;
  projeto: string;
  // ✅ FIX: team_id resolvido a partir do projeto cadastrado
  teamId: string;
  tipo: string;
  data_inicio: Date;
  situacao?: string;
  sla?: string;
  tipo_defeito?: string;
  originada_diagnostico?: boolean;
  descricao?: string;
  data_previsao_encerramento?: string;
  prazo_inicio_atendimento?: string;
  prazo_solucao?: string;
}

type ImportMode = null | "demandas" | "projetos";

export function ImportacaoView() {
  const { currentTeamId } = useAuth();
  // Busca projetos de TODOS os times para resolver team_id por nome de projeto
  const { projetos, reload: reloadProjetos } = useProjetos({ allTeams: true });
  const [mode, setMode] = useState<ImportMode>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    importados: number;
    atualizados: number;
    erros: number;
    tiposCriados?: string[];
  } | null>(null);
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [autoCreatedTypes, setAutoCreatedTypes] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [projetoResult, setProjetoResult] = useState<{ importados: number; existentes: number; erros: number } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ FIX: mapa nome-normalizado → { nome original, team_id }
  // Permite rotear cada demanda para o time correto com base no projeto do CSV
  const projetoMap = new Map(
    projetos.map((p) => [normalize(p.nome), { nome: p.nome, teamId: p.team_id }])
  );

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
      headers.forEach((h, i) => {
        obj[h] = (values[i] || "").trim();
      });
      return obj;
    });
  }

  const handleFileDemandas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeamId) return;

    setResult(null);
    setShowPreview(false);
    setErrors([]);
    setValidRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const rows = parseCsvToRows(buffer);

      const parsed: ParsedRow[] = [];
      const errs: ValidationError[] = [];
      const newTypes: string[] = [];

      rows.forEach((r, idx) => {
        const linha = idx + 2;

        const rhm = String(r["#"] || r["RHM"] || r["rhm"] || "").trim();
        const projeto = String(r["Projeto"] || r["projeto"] || "").trim();
        const tipoRaw = String(r["Tipo"] || r["tipo"] || "").trim();
        const dataInicioRaw =
          r["Criado em"] || r["Criado Em"] || r["Data de Início"] || r["Data de Inicio"] || r["data_inicio"] || null;

        const descricao =
          String(r["Título"] || r["Titulo"] || r["Subject"] || r["Descrição"] || r["descricao"] || "").trim() ||
          undefined;

        if (!rhm) {
          errs.push({ linha, mensagem: "# não informado." });
          return;
        }
        if (!projeto) {
          errs.push({ linha, mensagem: "Projeto não informado." });
          return;
        }

        // ✅ FIX: resolve nome + team_id a partir do mapa de projetos
        const projNorm = normalize(projeto);
        const projetoInfo = projetoMap.get(projNorm);
        if (!projetoInfo) {
          errs.push({ linha, mensagem: `Projeto '${projeto}' não encontrado. Verifique o cadastro.` });
          return;
        }

        if (!tipoRaw) {
          errs.push({ linha, mensagem: "Tipo não informado." });
          return;
        }
        const tipoResult = normalizeTipo(tipoRaw);
        if (!tipoResult) {
          errs.push({ linha, mensagem: `Tipo '${tipoRaw}' não reconhecido.` });
          return;
        }
        if (tipoResult.autoCreated && !newTypes.includes(tipoRaw)) newTypes.push(tipoRaw);
        const tipoNorm = tipoResult.value;

        if (!dataInicioRaw) {
          errs.push({ linha, mensagem: "Criado em inválido ou ausente." });
          return;
        }
        const dataInicio = parseDataInicio(dataInicioRaw);
        if (!dataInicio) {
          errs.push({ linha, mensagem: "Criado em inválido ou ausente." });
          return;
        }

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
          .trim()
          .toLowerCase();
        if (isCorretiva && defeitoRaw) {
          tipo_defeito = defeitoRaw === "sim" || defeitoRaw === "impeditivo" ? "impeditivo" : "nao_impeditivo";
        } else if (isCorretiva) {
          tipo_defeito = "impeditivo";
        }

        let originada_diagnostico = false;
        const diagRaw = String(r["Originada de Diagnóstico"] || r["Originada de Diagnostico"] || "")
          .trim()
          .toLowerCase();
        if (isCorretiva && (diagRaw === "sim" || diagRaw === "true" || diagRaw === "1")) originada_diagnostico = true;

        const regime = isCorretiva ? sla : undefined;
        const defeito = isCorretiva ? tipo_defeito : undefined;
        const prazoInicio = calcPrazoInicio(dataInicio, tipoNorm, regime, defeito);
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
          // ✅ FIX: team_id vem do projeto cadastrado, não do time ativo
          teamId: projetoInfo.teamId,
          tipo: tipoNorm,
          data_inicio: dataInicio,
          situacao,
          sla,
          tipo_defeito,
          originada_diagnostico,
          descricao,
          data_previsao_encerramento: prevEnc || (prazoSolucao ? format(prazoSolucao, "yyyy-MM-dd") : undefined),
          prazo_inicio_atendimento: prazoInicio?.toISOString(),
          prazo_solucao: prazoSolucao?.toISOString(),
        });
      });

      setValidRows(parsed);
      setErrors(errs);
      setAutoCreatedTypes(newTypes);
      setShowPreview(true);

      if (parsed.length === 0 && errs.length === 0) toast.error("Nenhuma linha encontrada no arquivo.");
    } catch {
      toast.error("Erro ao processar arquivo.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

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
        if (!nome) {
          results.erros++;
          continue;
        }
        if (existingNorms.has(normalize(nome))) {
          results.existentes++;
          continue;
        }

        const descricao = String(r["Descrição"] || r["Descricao"] || r["descricao"] || "").trim();
        const equipe = String(r["Equipe"] || r["equipe"] || "").trim();
        const slaRaw = String(r["SLA"] || r["sla"] || "").trim();
        const sla = normalizeSLA(slaRaw) || "padrao";

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

  // ✅ FIX: agrupa linhas válidas por teamId e faz 1 chamada RPC por time
  // Demandas do Rapina → team do Rapina | Demandas do GESP → team do GESP
  const handleImport = async () => {
    if (!currentTeamId || validRows.length === 0) return;
    setLoading(true);

    const results = { importados: 0, atualizados: 0, erros: 0 };

    // Agrupa por teamId
    const byTeam = new Map<string, ParsedRow[]>();
    for (const row of validRows) {
      const group = byTeam.get(row.teamId) ?? [];
      group.push(row);
      byTeam.set(row.teamId, group);
    }

    // 1 chamada RPC por time
    for (const [teamId, rows] of byTeam) {
      try {
        const res = await upsertDemandas(
          teamId,
          rows.map((row) => ({
            rhm: row.rhm,
            projeto: row.projeto,
            situacao: row.situacao || "fila_atendimento",
            tipo: row.tipo,
            sla: row.sla,
            descricao: row.descricao,
            tipo_defeito: row.tipo_defeito,
            originada_diagnostico: row.originada_diagnostico,
            data_previsao_encerramento: row.data_previsao_encerramento,
            prazo_inicio_atendimento: row.prazo_inicio_atendimento,
            prazo_solucao: row.prazo_solucao,
          })),
        );
        results.importados += res.importados;
        results.atualizados += res.atualizados;
        results.erros += res.erros;
      } catch {
        results.erros += rows.length;
      }
    }

    setResult({ ...results, tiposCriados: autoCreatedTypes });
    setShowPreview(false);
    const tipoMsg =
      autoCreatedTypes.length > 0 ? ` | ${autoCreatedTypes.length} tipo(s) criado(s) automaticamente` : "";
    toast.success(`Importação concluída: ${results.importados} novos, ${results.atualizados} atualizados${tipoMsg}`);
    setLoading(false);
  };

  if (mode === null) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h2 className="text-lg font-semibold">Importação</h2>
        <p className="text-sm text-muted-foreground">Selecione o tipo de importação que deseja realizar.</p>
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-info/40"
            onClick={() => setMode("demandas")}
          >
            <CardContent className="p-6 text-center space-y-3">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-info" />
              <h3 className="font-semibold">📋 Demandas</h3>
              <p className="text-xs text-muted-foreground">
                Importar do Redmine
                <br />
                (.csv / .xlsx)
              </p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-info/40"
            onClick={() => setMode("projetos")}
          >
            <CardContent className="p-6 text-center space-y-3">
              <FolderKanban className="h-10 w-10 mx-auto text-info" />
              <h3 className="font-semibold">📁 Projetos</h3>
              <p className="text-xs text-muted-foreground">
                Importar sistemas
                <br />
                de sustentação (.csv / .xlsx)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMode(null);
            setResult(null);
            setProjetoResult(null);
            setShowPreview(false);
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <h2 className="text-lg font-semibold">{mode === "demandas" ? "Importar Demandas" : "Importar Projetos"}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {mode === "demandas" ? "Importar do Redmine" : "Importar Projetos"}
          </CardTitle>
          <CardDescription>
            {mode === "demandas" ? (
              <>
                Faça upload do arquivo .csv exportado do Redmine.
                <br />
                Colunas obrigatórias: <strong>#, Projeto, Tipo, Criado em</strong>.<br />
                Coluna opcional importada: <strong>Título, Situação</strong>.
              </>
            ) : (
              <>
                Faça upload do arquivo .csv com as colunas: <strong>Nome, Descrição, Equipe, SLA</strong>.<br />
                <span className="text-xs text-muted-foreground">Projetos já cadastrados serão ignorados.</span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={mode === "demandas" ? handleFileDemandas : handleFileProjetos}
              className="hidden"
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
              {loading ? "Processando..." : "Selecionar Arquivo"}
            </Button>
          </div>

          {mode === "demandas" && showPreview && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 flex-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">{validRows.length} válida(s) pronta(s) para importar</span>
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">{errors.length} com erro(s)</span>
                  </div>
                )}
              </div>

              {autoCreatedTypes.length > 0 && (
                <div className="border border-amber-300 rounded-lg p-3 space-y-1.5 bg-amber-50">
                  <p className="text-xs font-semibold text-amber-800 uppercase">
                    Tipos não encontrados (serão criados automaticamente):
                  </p>
                  <ul className="list-disc pl-5 text-xs text-amber-700">
                    {autoCreatedTypes.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {errors.length > 0 && (
                <div className="border border-destructive/30 rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto bg-destructive/5">
                  <p className="text-xs font-semibold text-destructive uppercase">Erros encontrados:</p>
                  {errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <span>
                        Linha {err.linha}: {err.mensagem}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  style={{ backgroundColor: "#1a6fa8" }}
                  className="hover:opacity-90 text-white"
                  onClick={handleImport}
                  disabled={loading || validRows.length === 0}
                >
                  {loading ? "Importando..." : `Importar somente as válidas (${validRows.length})`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPreview(false);
                    setValidRows([]);
                    setErrors([]);
                    setAutoCreatedTypes([]);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {mode === "demandas" && result && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Resultado da importação
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center p-2 bg-emerald-50 rounded">
                  <p className="text-lg font-bold text-emerald-700">{result.importados}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="text-center p-2 rounded" style={{ backgroundColor: "#e8f2fa" }}>
                  <p className="text-lg font-bold" style={{ color: "#1a6fa8" }}>
                    {result.atualizados}
                  </p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <p className="text-lg font-bold text-destructive">{result.erros}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
              {result.tiposCriados && result.tiposCriados.length > 0 && (
                <div className="border border-amber-300 rounded-lg p-3 bg-amber-50 mt-2">
                  <p className="text-xs font-semibold text-amber-800">
                    Tipos criados automaticamente ({result.tiposCriados.length}):
                  </p>
                  <ul className="list-disc pl-5 text-xs text-amber-700 mt-1">
                    {result.tiposCriados.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {mode === "projetos" && projetoResult && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Resultado da importação
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center p-2 bg-emerald-50 rounded">
                  <p className="text-lg font-bold text-emerald-700">{projetoResult.importados}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="text-center p-2 rounded" style={{ backgroundColor: "#e8f2fa" }}>
                  <p className="text-lg font-bold" style={{ color: "#1a6fa8" }}>
                    {projetoResult.existentes}
                  </p>
                  <p className="text-xs text-muted-foreground">Já existentes</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <p className="text-lg font-bold text-destructive">{projetoResult.erros}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

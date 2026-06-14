import { useState, useEffect, useCallback, useMemo } from "react";
import { getInitials, formatPersonName } from "@/lib/personName";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock,
  History,
  FileText,
  Plus,
  Trash2,
  Pencil,
  Users,
  Edit,
  Save,
  X,
  Search,
  UserPlus,
  ArrowLeft,
  Check,
  Circle,
  ChevronRight,
  MoveRight,
  ShieldCheck,
  Upload,
  Link2,
  AlertCircle,
  Eye,
  Settings2,
} from "lucide-react";
import { JustificativaDialog } from "./JustificativaDialog";
import { EncerramentoDialog } from "./EncerramentoDialog";
import { SuspensaoDialog } from "./SuspensaoDialog";
import { NovaAtividadeDialog } from "./NovaAtividadeDialog";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { HorasInput, hhmmToDecimal } from "@/shared/components/common/HorasInput";
import { ReportFilterBar } from "@/shared/components/reports/ReportFilterBar";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { buildAnalistasDedup, analistaMatches } from "../utils/analistasDedup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Demanda, DemandaHour } from "../types/demanda";
import {
  SITUACAO_LABELS,
  SITUACAO_COLORS,
  FASES,
  FASE_LABELS,
  ALL_SITUACOES,
  REQUIRES_JUSTIFICATIVA,
  TERMINAL_STATUSES,
  isDemandaIniciada,
} from "../types/demanda";
import { getTipoLabel, getSLAStatusDemanda, TIPOS_DEMANDA_IMR } from "../types/imr";
import { useTransitions, useHours } from "../hooks/useDemandas";
import { useProjetos } from "../hooks/useProjetos";
import { useFases } from "../hooks/useFases";
import { useWorkflowSteps } from "../hooks/useWorkflowSteps";
import * as respSvc from "../services/responsaveis.service";
import * as evidSvc from "../services/evidencias.service";
import * as eventosSvc from "../services/eventos.service";
import {
  fetchProfileDisplayNameById,
  fetchProfilesByUserIds,
} from "../services/profiles.service";
import type { DemandaResponsavel } from "../services/responsaveis.service";
import type { DemandaEvidencia } from "../services/evidencias.service";

interface Props {
  demanda: Demanda | null;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Demanda>) => Promise<void>;
  onMoveTo: (demanda: Demanda, newStatus: string, justificativa?: string) => Promise<boolean>;
  initialTab?: string;
  pendingMoveTarget?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOVO FLUXO DE TRABALHO — 11 etapas
// ─────────────────────────────────────────────────────────────────────────────
export const WORKFLOW_STEPS = [
  "fila_atendimento",
  "planejamento_elaboracao",
  "planejamento_ag_aprovacao",
  "planejamento_aprovada",
  "em_execucao",
  "bloqueada",
  "hom_ag_homologacao",
  "hom_homologada",
  "rejeitada",
  "fila_producao",
  "ag_aceite_final",
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export const WORKFLOW_LABELS: Record<string, string> = {
  fila_atendimento: "Fila de Atendimento",
  planejamento_elaboracao: "Planejamento: Em Elaboração",
  planejamento_ag_aprovacao: "Planejamento: Ag. Aprovação",
  planejamento_aprovada: "Planejamento: Aprovada p/ Exec",
  em_execucao: "Em Execução",
  bloqueada: "Bloqueada",
  hom_ag_homologacao: "Hom: Ag. Homologação",
  hom_homologada: "Hom: Homologada",
  rejeitada: "Rejeitada",
  fila_producao: "Fila para Produção (Infra)",
  ag_aceite_final: "Ag. Aceite Final",
};

export const WORKFLOW_COLORS: Record<string, string> = {
  fila_atendimento: "bg-slate-100 text-slate-700 border-slate-300",
  planejamento_elaboracao: "bg-blue-100 text-blue-700 border-blue-300",
  planejamento_ag_aprovacao: "bg-indigo-100 text-indigo-700 border-indigo-300",
  planejamento_aprovada: "bg-violet-100 text-violet-700 border-violet-300",
  em_execucao: "bg-amber-100 text-amber-700 border-amber-300",
  bloqueada: "bg-red-100 text-red-700 border-red-300",
  hom_ag_homologacao: "bg-cyan-100 text-cyan-700 border-cyan-300",
  hom_homologada: "bg-teal-100 text-teal-700 border-teal-300",
  rejeitada: "bg-rose-100 text-rose-800 border-rose-300",
  fila_producao: "bg-orange-100 text-orange-700 border-orange-300",
  ag_aceite_final: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

// Etapas exibidas no stepper visual (excluindo as de desvio: bloqueada/rejeitada)
const STEPPER_STEPS = [
  "fila_atendimento",
  "planejamento_elaboracao",
  "planejamento_ag_aprovacao",
  "planejamento_aprovada",
  "em_execucao",
  "hom_ag_homologacao",
  "hom_homologada",
  "fila_producao",
  "ag_aceite_final",
];

const STEPPER_LABELS: Record<string, string> = {
  fila_atendimento: "Fila Atend.",
  planejamento_elaboracao: "Elaboração",
  planejamento_ag_aprovacao: "Ag. Aprov.",
  planejamento_aprovada: "Aprovada",
  em_execucao: "Execução",
  hom_ag_homologacao: "Ag. Homol.",
  hom_homologada: "Homologada",
  fila_producao: "Fila Prod.",
  ag_aceite_final: "Aceite Final",
};

// Fluxo principal de avanço (sem desvios)
const FLOW_PRINCIPAL = [
  "fila_atendimento",
  "planejamento_elaboracao",
  "planejamento_ag_aprovacao",
  "planejamento_aprovada",
  "em_execucao",
  "hom_ag_homologacao",
  "hom_homologada",
  "fila_producao",
  "ag_aceite_final",
];

// Status considerados terminais (não permitem mais movimentação)
const TERMINAL_WORKFLOW = ["ag_aceite_final", "rejeitada", "cancelada"];

// Status que ativam modal de suspensão/bloqueio
const SUSPENSAO_STATUSES = ["bloqueada"];

// ─────────────────────────────────────────────────────────────────────────────
// HoursTable — extraída para permitir hooks (paginação) sob filtros dinâmicos
// ─────────────────────────────────────────────────────────────────────────────
function HoursTable({
  rows,
  profilesMap,
  fasesMap,
  isAdmin,
  minutesToDisplay,
  onEdit,
  onDelete,
}: {
  rows: DemandaHour[];
  profilesMap: Map<string, string>;
  fasesMap: Record<string, string>;
  isAdmin: boolean;
  minutesToDisplay: (m: number) => string;
  onEdit: (h: DemandaHour) => void;
  onDelete: (id: string) => void;
}) {
  const { currentPage, setCurrentPage, totalItems, pageSize, paginatedItems } =
    usePagination(rows, { pageSize: 10 });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
        Nenhum lançamento no período/analista selecionado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border overflow-x-auto" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Data", "Fase", "Descrição", "Lançado por"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tempo</th>
              {isAdmin && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedItems.map((h) => (
              <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 text-xs">{new Date(h.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-3 py-2.5 text-xs">{fasesMap[h.fase] || h.fase}</td>
                <td className="px-3 py-2.5 text-xs max-w-[200px] truncate">{h.descricao || "-"}</td>
                <td className="px-3 py-2.5 text-xs">{profilesMap.get(h.user_id) || "..."}</td>
                <td className="px-3 py-2.5 text-xs text-right font-mono font-medium">{minutesToDisplay(Number(h.horas))}</td>
                {isAdmin && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => onEdit(h)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(h.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

// Status que exigem justificativa obrigatória
const REQUIRES_JUSTIFICATIVA_WORKFLOW = ["rejeitada", "cancelada", "planejamento_ag_aprovacao"];

// ─────────────────────────────────────────────────────────────────────────────

const PAPEIS_OPTIONS = [
  { value: "analista", label: "Analista" },
  { value: "arquiteto", label: "Arquiteto" },
  { value: "desenvolvedor", label: "Desenvolvedor" },
  { value: "testador", label: "Testador" },
  { value: "gestor", label: "Gestor" },
];

const EVIDENCIA_FASES = [
  "fila_atendimento",
  "planejamento_elaboracao",
  "planejamento_ag_aprovacao",
  "planejamento_aprovada",
  "em_execucao",
  "hom_ag_homologacao",
  "hom_homologada",
  "fila_producao",
  "ag_aceite_final",
];

const EVIDENCIA_FASE_LABELS: Record<string, string> = {
  fila_atendimento: "Fila de Atendimento",
  planejamento_elaboracao: "Elaboração",
  planejamento_ag_aprovacao: "Ag. Aprovação",
  planejamento_aprovada: "Aprovada p/ Exec",
  em_execucao: "Em Execução",
  hom_ag_homologacao: "Ag. Homologação",
  hom_homologada: "Homologada",
  fila_producao: "Fila Produção",
  ag_aceite_final: "Aceite Final",
};

function getNextStatuses(situacao: string): string[] {
  if (TERMINAL_WORKFLOW.includes(situacao)) return [];
  const idx = FLOW_PRINCIPAL.indexOf(situacao);
  if (situacao === "bloqueada") return [];
  if (situacao === "rejeitada") return ["em_execucao"];
  if (idx < 0) return [];
  const next = FLOW_PRINCIPAL.slice(idx + 1);
  if (situacao === "hom_homologada") {
    return [...next, "rejeitada"];
  }
  return next;
}

type DemandaExt = Demanda & {
  demandante?: string | null;
  ordem_servico?: string | null;
  tipo_defeito?: string | null;
  originada_diagnostico?: boolean;
  prazo_inicio_atendimento?: string | null;
  prazo_solucao?: string | null;
  data_previsao_encerramento?: string | null;
  nota_satisfacao?: number | null;
  cobertura_testes?: number | null;
  artefatos_atualizados?: string | null;
  hard_code_identificado?: boolean | null;
  reincidencia_defeito?: boolean | null;
  contador_rejeicoes?: number;
};

/** Converte minutos decimais para string "HH:MM" para exibição na tabela */
function minutesToDisplay(horas: number): string {
  const totalMinutes = Math.round(horas * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── cor teal do design system ───────────────────────────────────────────────
const TEAL = "#0bbcaf";
const TEAL_BG = "rgba(11,188,175,0.1)";
const TEAL_BORDER = "rgba(11,188,175,0.35)";

export function DemandaDetail({
  demanda: rawDemanda,
  onBack,
  onUpdate,
  onMoveTo,
  initialTab,
  pendingMoveTarget,
}: Props) {
  const demanda = rawDemanda as DemandaExt | null;
  const { user, profile, isAdmin, currentTeamId } = useAuth();
  const { fases, create: createFase, remove: removeFase } = useFases();
  const fasesMap = useMemo(() => {
    const m: Record<string, string> = { ...FASE_LABELS };
    fases.forEach((f) => { m[f.key] = f.label; });
    return m;
  }, [fases]);
  const { transitions, loading: tLoading, reload: reloadTransitions } = useTransitions(demanda?.id ?? null);
  const {
    hours,
    total,
    add: addHour,
    update: updateHour,
    remove: removeHour,
    loading: hLoading,
    reload: reloadHours,
  } = useHours(demanda?.id ?? null);
  const { projetos } = useProjetos();

  const [activeTab, setActiveTab] = useState(initialTab || "detalhes");
  const [pendingTarget, setPendingTarget] = useState<string | undefined>(pendingMoveTarget);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    projeto: "",
    tipo: "",
    descricao: "",
    sla: "",
    rhm: "",
    tipo_defeito: "" as string | null,
    originada_diagnostico: false,
    data_previsao_encerramento: "" as string | null,
    demandante: "" as string | null,
  });

  const [newStatus, setNewStatus] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [showJustModal, setShowJustModal] = useState(false);
  const [showSuspensaoModal, setShowSuspensaoModal] = useState(false);
  const [showEncerramentoModal, setShowEncerramentoModal] = useState(false);

  const todayISO = () => new Date().toISOString().slice(0, 10);

  // ─── Estado do formulário inline de lançamento de horas ───
  const [hourForm, setHourForm] = useState({
    horas: "",
    fase: "execucao",
    descricao: "",
    data: todayISO(),
  });

  const [showFasesManager, setShowFasesManager] = useState(false);
  const [newFaseLabel, setNewFaseLabel] = useState("");
  const [deleteHourId, setDeleteHourId] = useState<string | null>(null);
  const [editHour, setEditHour] = useState<DemandaHour | null>(null);
  const [showEditHourDialog, setShowEditHourDialog] = useState(false);

  // ── Filtros + paginação da aba Atividades (lançamentos de horas)
  const hoursToday = () => new Date().toISOString().split("T")[0];
  const hoursDaysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  };
  const [hoursPeriodo, setHoursPeriodo]   = useState("30");
  const [hoursDataInicio, setHoursDataInicio] = useState(hoursDaysAgo(30));
  const [hoursDataFim, setHoursDataFim]   = useState(hoursToday());
  const [hoursAnalista, setHoursAnalista] = useState<string>("all");

  const [responsaveis, setResponsaveis] = useState<DemandaResponsavel[]>([]);
  const [respLoading, setRespLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ user_id: string; display_name: string; email: string }[]>([]);
  const [addPapel, setAddPapel] = useState("desenvolvedor");
  const [deleteRespId, setDeleteRespId] = useState<string | null>(null);

  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [demandanteProfile, setDemandanteProfile] = useState<string | null>(null);

  const [evidencias, setEvidencias] = useState<DemandaEvidencia[]>([]);
  const [evidLoading, setEvidLoading] = useState(false);
  const [evidForm, setEvidForm] = useState({
    fase: demanda?.situacao || "em_execucao",
    tipo: "arquivo",
    titulo: "",
    descricao: "",
    url_externa: "",
  });
  const [evidFile, setEvidFile] = useState<File | null>(null);
  const [deleteEvidId, setDeleteEvidId] = useState<string | null>(null);

  const loadEvidencias = useCallback(async () => {
    if (!demanda?.id) return;
    setEvidLoading(true);
    try {
      setEvidencias(await evidSvc.fetchEvidencias(demanda.id));
    } catch {}
    setEvidLoading(false);
  }, [demanda?.id]);

  const loadResponsaveis = useCallback(async () => {
    if (!demanda?.id) return;
    setRespLoading(true);
    try {
      setResponsaveis(await respSvc.fetchResponsaveis(demanda.id));
    } catch {}
    setRespLoading(false);
  }, [demanda?.id]);

  useEffect(() => {
    if (demanda?.id) {
      loadResponsaveis();
      loadEvidencias();
      setEditing(false);
      setEvidForm((prev) => ({ ...prev, fase: demanda.situacao || "em_execucao" }));
    }
  }, [demanda?.id, demanda?.situacao, loadResponsaveis, loadEvidencias]);

  useEffect(() => {
    if (!demanda?.demandante) {
      setDemandanteProfile(null);
      return;
    }
    fetchProfileDisplayNameById(demanda.demandante!).then(setDemandanteProfile);
  }, [demanda?.demandante]);

  useEffect(() => {
    if (hours.length === 0) return;
    const ids = [...new Set(hours.map((h) => h.user_id))];
    const missing = ids.filter((id) => !profilesMap.has(id));
    if (missing.length === 0) return;
    fetchProfilesByUserIds(missing).then((map) => {
      if (map.size === 0) return;
      setProfilesMap((prev) => {
        const next = new Map(prev);
        map.forEach((p, id) => next.set(id, p.display_name));
        return next;
      });
    });
  }, [hours]);

  if (!demanda) return null;

  const isCancelada = demanda.situacao === "cancelada";
  const isRejeitada = demanda.situacao === "rejeitada";
  const isTerminal = TERMINAL_WORKFLOW.includes(demanda.situacao);
  const isBloqueada = demanda.situacao === "bloqueada";

  const currentStepIdx = STEPPER_STEPS.indexOf(demanda.situacao);

  // Fluxo dinâmico: lê a tabela sustentacao_workflow_steps (com fallback estático).
  // "Mover para" passa a espelhar exatamente as etapas configuradas em
  // Sustentação → Fluxo de Trabalho.
  const workflowSteps = useWorkflowSteps();
  const dynamicFlow = useMemo(
    () => workflowSteps.filter((s) => !s.isTerminal && s.key !== "bloqueada").map((s) => s.key),
    [workflowSteps],
  );

  const allowedNextStatuses = useMemo<string[]>(() => {
    if (isTerminal) return [];
    if (isBloqueada) return [];
    if (isRejeitada) return ["em_execucao"];
    const idx = dynamicFlow.indexOf(demanda.situacao);
    if (idx < 0) {
      // Situação fora do fluxo configurado → libera todos os destinos não-terminais
      return dynamicFlow.filter((k) => k !== demanda.situacao);
    }
    const next = dynamicFlow.slice(idx + 1);
    if (demanda.situacao === "hom_homologada") return [...next, "rejeitada"];
    return next;
  }, [dynamicFlow, demanda.situacao, isTerminal, isBloqueada, isRejeitada]);

  const canBlock = !isTerminal && !isBloqueada && demanda.situacao !== "ag_aceite_final";
  const canCancel = !isTerminal && demanda.situacao !== "ag_aceite_final";
  const canReject = demanda.situacao === "hom_homologada";

  const slaStatus = getSLAStatusDemanda(demanda.created_at, demanda.prazo_solucao || null, demanda.situacao);

  const currentFaseIdx = EVIDENCIA_FASES.indexOf(demanda.situacao);
  const allowedEvidFases = currentFaseIdx >= 0 ? EVIDENCIA_FASES.slice(0, currentFaseIdx + 1) : EVIDENCIA_FASES;

  const getMissingEvidencias = (targetStatus: string): string[] => {
    if (targetStatus !== "planejamento_ag_aprovacao") return [];
    const faseEvidencias = evidencias.filter((e) => e.fase === demanda.situacao);
    if (faseEvidencias.length > 0) return [];
    return ["É obrigatório anexar ao menos uma evidência antes de avançar para Ag. Aprovação."];
  };

  const startEdit = () => {
    setEditForm({
      projeto: demanda.projeto,
      tipo: demanda.tipo,
      descricao: demanda.descricao || "",
      sla: demanda.sla,
      rhm: demanda.rhm,
      tipo_defeito: demanda.tipo_defeito || null,
      originada_diagnostico: !!demanda.originada_diagnostico,
      data_previsao_encerramento: demanda.data_previsao_encerramento || null,
      demandante: demanda.demandante || null,
    });
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = async () => {
    try {
      await onUpdate(demanda.id, {
        projeto: editForm.projeto,
        tipo: editForm.tipo as any,
        descricao: editForm.descricao,
        sla: editForm.sla as any,
        rhm: editForm.rhm,
        tipo_defeito: editForm.tipo_defeito,
        originada_diagnostico: editForm.originada_diagnostico,
        data_previsao_encerramento: editForm.data_previsao_encerramento,
        demandante: editForm.demandante,
      } as any);
      setEditing(false);
    } catch {
      toast.error("Erro ao salvar alterações");
    }
  };

  const handleMove = async () => {
    if (!newStatus) return;

    const missing = getMissingEvidencias(newStatus);
    if (missing.length > 0) {
      setPendingTarget(newStatus);
      setActiveTab("evidencias");
      toast.warning(`Evidência obrigatória pendente. Cadastre a evidência antes de avançar.`);
      return;
    }

    if (newStatus === "ag_aceite_final") {
      setShowEncerramentoModal(true);
      return;
    }

    if (SUSPENSAO_STATUSES.includes(newStatus)) {
      setShowSuspensaoModal(true);
      return;
    }

    if (REQUIRES_JUSTIFICATIVA_WORKFLOW.includes(newStatus)) {
      setShowJustModal(true);
      return;
    }

    const ok = await onMoveTo(demanda, newStatus);
    if (ok) {
      setNewStatus("");
      await refreshAllData();
    }
  };

  const confirmJustificativa = async (justificativaText: string) => {
    if (!newStatus) return;
    const ok = await onMoveTo(demanda, newStatus, justificativaText);
    if (ok) {
      setNewStatus("");
      setShowJustModal(false);
      await refreshAllData();
    }
  };

  const confirmSuspensao = async (just: string, novaPrevisao: string) => {
    if (!newStatus || !user) return;
    try {
      await eventosSvc.addEvento({
        demanda_id: demanda.id,
        tipo_evento: "E6",
        descricao: `Bloqueio: ${just}. Nova previsão: ${novaPrevisao}`,
        redutor: 0.1,
        incidencia: "limitada",
        user_id: user.id,
      });
    } catch {}
    await onUpdate(demanda.id, { data_previsao_encerramento: novaPrevisao } as any);
    const ok = await onMoveTo(demanda, newStatus, just);
    if (ok) {
      setNewStatus("");
      setShowSuspensaoModal(false);
      await refreshAllData();
      toast.info("Evento E6 registrado no log da demanda.");
    }
  };

  const confirmEncerramento = async (data: {
    nota_satisfacao: number;
    cobertura_testes: number;
    artefatos_atualizados: string;
    hard_code_identificado: boolean;
    reincidencia_defeito: boolean | null;
  }) => {
    if (!user) return;
    await onUpdate(demanda.id, {
      nota_satisfacao: data.nota_satisfacao,
      cobertura_testes: data.cobertura_testes,
      artefatos_atualizados: data.artefatos_atualizados,
      hard_code_identificado: data.hard_code_identificado,
      reincidencia_defeito: data.reincidencia_defeito,
      aceite_data: new Date().toISOString(),
      aceite_responsavel: user.id,
    } as any);

    const events: Array<{ tipo: string; redutor: number; incidencia: string; desc: string }> = [];
    if (data.artefatos_atualizados === "nao")
      events.push({ tipo: "E5", redutor: 0.1, incidencia: "limitada", desc: "Artefatos não atualizados após manutenção" });
    if (data.hard_code_identificado)
      events.push({ tipo: "E4", redutor: 0.1, incidencia: "integral", desc: "Hard code de parâmetros importantes" });
    if (data.reincidencia_defeito) {
      events.push({ tipo: "E7", redutor: 0.2, incidencia: "limitada", desc: "Reincidência de defeito impeditivo" });
      events.push({ tipo: "E14", redutor: 0.2, incidencia: "limitada", desc: "Reincidência de defeito impeditivo de sprint anterior" });
    }

    for (const ev of events) {
      try {
        await eventosSvc.addEvento({
          demanda_id: demanda.id,
          tipo_evento: ev.tipo,
          descricao: ev.desc,
          redutor: ev.redutor,
          incidencia: ev.incidencia,
          user_id: user.id,
        });
      } catch {}
    }

    const ok = await onMoveTo(demanda, "ag_aceite_final");
    if (ok) {
      setNewStatus("");
      setShowEncerramentoModal(false);
      await refreshAllData();
      if (events.length > 0) toast.info(`${events.length} evento(s) de glosa registrado(s).`);
    }
  };

  const refreshAllData = async () => {
    await Promise.all([loadResponsaveis(), loadEvidencias(), reloadTransitions(), reloadHours()]);
  };

  const handleUnblock = async () => {
    if (demanda.situacao !== "bloqueada") return;
    const sorted = [...transitions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const blockTransition = sorted.find((t) => t.to_status === "bloqueada");
    const previousStatus = blockTransition?.from_status || "fila_atendimento";
    const ok = await onMoveTo(demanda, previousStatus, "Desbloqueio — retorno à etapa anterior");
    if (ok) toast.success(`Demanda desbloqueada → ${WORKFLOW_LABELS[previousStatus] || previousStatus}`);
  };

  const handleAddHour = async () => {
    const horasDecimal = hhmmToDecimal(hourForm.horas);
    if (!horasDecimal || horasDecimal <= 0) {
      toast.error("Informe um tempo válido.");
      return;
    }
    const created_at = hourForm.data
      ? new Date(hourForm.data + "T12:00:00").toISOString()
      : undefined;
    await addHour({ horas: horasDecimal, fase: hourForm.fase, descricao: hourForm.descricao, created_at });
    setHourForm({ horas: "", fase: "execucao", descricao: "", data: todayISO() });
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      // FIX: escopo CORRETO da busca = CONTRATO. Quando a demanda tem
      // contract_id, agrega usuários de TODOS os times do contrato +
      // membros diretos do contrato. Fallback por team_id apenas para
      // demandas legadas sem contrato.
      const contractId = (demanda as any)?.contract_id ?? null;
      const teamId     = (demanda as any)?.team_id ?? currentTeamId;
      const results    = await respSvc.searchProfiles(q, { contractId, teamId });
      const existing = new Set(responsaveis.map((r) => r.user_id));
      setSearchResults(results.filter((r) => !existing.has(r.user_id)));
    } catch {}
  };

  const handleAddResp = async (userId: string) => {
    if (!demanda?.id) return;
    try {
      const papel = await respSvc.fetchPrimaryRoleLabel(userId);
      await respSvc.addResponsavel(demanda.id, userId, papel);
      toast.success("Responsável adicionado");
      setSearchQuery("");
      setSearchResults([]);
      await loadResponsaveis();
    } catch {
      toast.error("Erro ao adicionar responsável");
    }
  };

  const handleRemoveResp = async () => {
    if (!deleteRespId) return;
    try {
      await respSvc.removeResponsavel(deleteRespId);
      toast.success("Responsável removido");
      setDeleteRespId(null);
      await loadResponsaveis();
    } catch {
      toast.error("Erro ao remover responsável");
    }
  };

  const handleAddEvidencia = async () => {
    if (!demanda?.id || !user?.id) return;
    if (!evidForm.titulo.trim()) { toast.error("Informe o título da evidência"); return; }
    try {
      let filePath: string | undefined, fileName: string | undefined, mimeType: string | undefined;
      if (evidForm.tipo === "arquivo" && evidFile) {
        const result = await evidSvc.uploadEvidenciaFile(evidFile, demanda.id);
        filePath = result.path;
        fileName = evidFile.name;
        mimeType = evidFile.type;
      }
      await evidSvc.addEvidencia({
        demanda_id: demanda.id,
        fase: evidForm.fase,
        tipo: evidForm.tipo,
        titulo: evidForm.titulo,
        descricao: evidForm.descricao || undefined,
        file_path: filePath,
        file_name: fileName,
        mime_type: mimeType,
        url_externa: evidForm.tipo === "link" ? evidForm.url_externa : undefined,
        user_id: user.id,
      });
      toast.success("Evidência adicionada");
      setEvidForm({ fase: demanda.situacao || "em_execucao", tipo: "arquivo", titulo: "", descricao: "", url_externa: "" });
      setEvidFile(null);
      await loadEvidencias();
    } catch {
      toast.error("Erro ao adicionar evidência");
    }
  };

  const handleRemoveEvidencia = async () => {
    if (!deleteEvidId) return;
    try {
      await evidSvc.removeEvidencia(deleteEvidId);
      toast.success("Evidência removida");
      setDeleteEvidId(null);
      await loadEvidencias();
    } catch {
      toast.error("Erro ao remover evidência");
    }
  };

  const evidenciasByFase = EVIDENCIA_FASES.reduce(
    (acc, fase) => { acc[fase] = evidencias.filter((e) => e.fase === fase); return acc; },
    {} as Record<string, DemandaEvidencia[]>,
  );

  const SLA_COR_CLASS: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    orange: "bg-orange-100 text-orange-800 border-orange-200",
    red: "bg-destructive/10 text-destructive border-destructive/30",
    muted: "bg-muted text-muted-foreground",
  };

  const isCorretiva = ["manutencao_corretiva", "corretiva"].includes(demanda.tipo);
  const dynamicLabelMap = useMemo(
    () => Object.fromEntries(workflowSteps.map((s) => [s.key, s.label])),
    [workflowSteps],
  );
  const resolveLabel = (s: string) =>
    dynamicLabelMap[s] || WORKFLOW_LABELS[s] || SITUACAO_LABELS[s] || s;
  const resolveColor = (s: string) => WORKFLOW_COLORS[s] || SITUACAO_COLORS[s] || "";

  return (
    <>
      <div className="w-full max-w-[1100px] mx-auto py-6 px-4 md:px-0 space-y-6 animate-in fade-in duration-300">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Demandas
          </Button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono font-semibold" style={{ color: TEAL }}>{demanda.rhm}</span>
        </div>

        <div className="bg-card rounded-xl border shadow-sm">
          {/* ── Header com accent bar teal ── */}
          <div className="px-6 py-5 border-b" style={{ borderLeft: `4px solid ${TEAL}`, borderRadius: "12px 12px 0 0" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight font-mono" style={{ color: TEAL }}>{demanda.rhm}</h1>
                  <Badge className={`text-xs ${resolveColor(demanda.situacao)}`}>{resolveLabel(demanda.situacao)}</Badge>
                  <Badge className={`text-xs ${SLA_COR_CLASS[slaStatus.cor]}`}>
                    {slaStatus.cor === "green" ? "🟢" : slaStatus.cor === "yellow" ? "🟡" : slaStatus.cor === "orange" ? "🟠" : "🔴"}{" "}
                    {slaStatus.label}
                  </Badge>
                  {isBloqueada && <Badge className="text-xs bg-red-100 text-red-700 border-red-300">🔒 Bloqueada</Badge>}
                  {isRejeitada && <Badge className="text-xs bg-rose-100 text-rose-800 border-rose-300">❌ Rejeitada</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {demanda.projeto} · <span>{getTipoLabel(demanda.tipo)}</span> · Criada em{" "}
                  {new Date(demanda.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isTerminal ? (
                  <Badge className="bg-gray-200 text-gray-700 border-gray-300 text-xs">Somente leitura</Badge>
                ) : editing ? (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={cancelEdit}>
                      <X className="h-4 w-4" />Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-white"
                      style={{ background: TEAL }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                      onClick={saveEdit}
                    >
                      <Save className="h-4 w-4" />Salvar
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                    <Edit className="h-4 w-4" />Editar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Stepper com nó ativo em teal ── */}
          <div className="px-6 py-4 border-b bg-muted/30 overflow-x-auto">
            <div className="flex items-center min-w-max">
              {STEPPER_STEPS.map((step, idx) => {
                const isActive = demanda.situacao === step;
                const isPast = currentStepIdx >= 0 && idx < currentStepIdx;
                const isLast = idx === STEPPER_STEPS.length - 1;
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="flex items-center justify-center h-7 w-7 rounded-full border-2 transition-all"
                        style={
                          isPast
                            ? { background: "#10b981", borderColor: "#10b981", color: "#fff" }
                            : isActive
                            ? { background: TEAL, borderColor: TEAL, color: "#fff", boxShadow: `0 0 0 3px ${TEAL_BG}` }
                            : {}
                        }
                      >
                        {isPast ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : isActive ? (
                          <Circle className="h-2.5 w-2.5 fill-current" />
                        ) : (
                          <span className="text-[10px] font-medium text-muted-foreground">{idx + 1}</span>
                        )}
                      </div>
                      <span
                        className="text-[10px] font-medium text-center leading-tight max-w-[72px]"
                        style={
                          isActive
                            ? { color: TEAL, fontWeight: 600 }
                            : isPast
                            ? { color: "#10b981" }
                            : { color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        {STEPPER_LABELS[step]}
                      </span>
                    </div>
                    {!isLast && (
                      <div
                        className="flex-1 h-0.5 mx-1.5 mt-[-18px] rounded-full transition-colors"
                        style={
                          isPast
                            ? { background: "#10b981" }
                            : isActive
                            ? { background: `linear-gradient(to right, ${TEAL}, hsl(var(--border)))` }
                            : { background: "hsl(var(--border))" }
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {(isBloqueada || isRejeitada) && (
              <div className={`mt-2 flex items-center gap-2 text-xs font-medium px-1 ${isBloqueada ? "text-red-600" : "text-rose-700"}`}>
                <AlertCircle className="h-3.5 w-3.5" />
                {isBloqueada ? "Demanda pausada — aguardando desbloqueio para retomar o fluxo" : "Demanda rejeitada — necessário corrigir e retornar para Execução"}
              </div>
            )}
          </div>

          {/* ── Painel de movimentação com fundo teal suave ── */}
          {!editing && !isTerminal && (
            <div className="px-6 py-3 border-b" style={{ background: TEAL_BG }}>
              {isBloqueada ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-medium text-destructive shrink-0">Demanda bloqueada</span>
                  <Button
                    className="text-white h-8 text-sm"
                    style={{ background: "#10b981" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#059669")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#10b981")}
                    onClick={handleUnblock}
                  >
                    Desbloquear (retornar à etapa anterior)
                  </Button>
                </div>
              ) : isRejeitada ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span className="text-sm font-medium text-rose-700 shrink-0">Demanda rejeitada — reencaminhar para execução</span>
                  <Button
                    className="text-white h-8 text-sm"
                    style={{ background: TEAL }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                    onClick={async () => {
                      const ok = await onMoveTo(demanda, "em_execucao", "Reencaminhado após rejeição");
                      if (ok) await refreshAllData();
                    }}
                  >
                    Retornar para Em Execução
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <MoveRight className="h-4 w-4 shrink-0" style={{ color: TEAL }} />
                  <span className="text-sm font-medium text-foreground shrink-0">Mover para:</span>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="h-9 text-sm flex-1 max-w-xs bg-card">
                      <SelectValue placeholder="Selecione a próxima etapa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedNextStatuses.filter((s) => s !== "rejeitada").map((s) => (
                        <SelectItem key={s} value={s}>{resolveLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-9 text-sm text-white"
                    style={{ background: TEAL }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                    onClick={handleMove}
                    disabled={!newStatus}
                  >
                    Avançar
                  </Button>
                  {canBlock && (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setNewStatus("bloqueada"); setShowSuspensaoModal(true); }}>
                      Bloquear
                    </Button>
                  )}
                  {canReject && (
                    <Button variant="outline" size="sm" className="text-rose-700 border-rose-300 hover:bg-rose-50"
                      onClick={() => { setNewStatus("rejeitada"); setShowJustModal(true); }}>
                      Rejeitar
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="outline" size="sm" className="text-gray-600 border-gray-300 hover:bg-gray-100"
                      onClick={() => { setNewStatus("cancelada"); setShowJustModal(true); }}>
                      Cancelar Demanda
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {isTerminal && (
            <div className="px-6 py-3 border-b bg-gray-100">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{isCancelada ? "Esta demanda foi cancelada e não pode ser editada ou movida." : "Esta demanda foi concluída com aceite final."}</span>
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="px-6 py-5">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
                {[
                  { value: "detalhes", icon: <FileText className="h-4 w-4" />, label: "Detalhes" },
                  { value: "historico", icon: <History className="h-4 w-4" />, label: "Histórico" },
                  { value: "horas", icon: <Clock className="h-4 w-4" />, label: "Atividades", badge: minutesToDisplay(total), disabled: isCancelada },
                  { value: "responsaveis", icon: <Users className="h-4 w-4" />, label: "Responsáveis", badge: String(responsaveis.length) },
                  { value: "evidencias", icon: <ShieldCheck className="h-4 w-4" />, label: "Evidências", badge: String(evidencias.length) },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    disabled={tab.disabled}
                    className="gap-1.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {tab.icon}{tab.label}
                    {tab.badge !== undefined && (
                      <span
                        className="ml-1 text-[10px] h-5 px-1.5 rounded-full flex items-center font-medium"
                        style={
                          activeTab === tab.value
                            ? { background: TEAL_BG, color: TEAL }
                            : { background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }
                        }
                      >
                        {tab.badge}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ─── ABA DETALHES ─── */}
              <TabsContent value="detalhes" className="mt-5">
                {editing ? (
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">#</Label>
                        <Input value={editForm.rhm} onChange={(e) => setEditForm((p) => ({ ...p, rhm: e.target.value.replace(/\D/g, "") }))} className="mt-1" inputMode="numeric" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Projeto</Label>
                        <Select value={editForm.projeto || "_none"} onValueChange={(v) => setEditForm((p) => ({ ...p, projeto: v === "_none" ? "" : v }))}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Selecione</SelectItem>
                            {projetos.map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Tipo</Label>
                        <Select value={editForm.tipo} onValueChange={(v) => setEditForm((p) => ({ ...p, tipo: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{TIPOS_DEMANDA_IMR.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Regime (SLA)</Label>
                        <Select value={editForm.sla} onValueChange={(v) => setEditForm((p) => ({ ...p, sla: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="padrao">Padrão</SelectItem>
                            <SelectItem value="continuo">Contínuo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Defeito Impeditivo</Label>
                        <Select value={editForm.tipo_defeito || ""} onValueChange={(v) => setEditForm((p) => ({ ...p, tipo_defeito: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Previsão de Encerramento</Label>
                        <Input type="date" value={editForm.data_previsao_encerramento || ""} onChange={(e) => setEditForm((p) => ({ ...p, data_previsao_encerramento: e.target.value || null }))} className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Título</Label>
                      <Textarea value={editForm.descricao} onChange={(e) => setEditForm((p) => ({ ...p, descricao: e.target.value }))} rows={6} className="mt-1" />
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-1">Título</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{demanda.descricao || "Sem descrição informada."}</p>
                      </div>

                      {/* ── Card informações com divide-y ── */}
                      <div className="rounded-xl border overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                        <div className="px-4 py-2.5 border-b bg-muted/40">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações</p>
                        </div>
                        <dl className="divide-y text-sm">
                          {[
                            { label: "Projeto", value: demanda.projeto },
                            { label: "Tipo", value: getTipoLabel(demanda.tipo) },
                            { label: "Regime", value: String(demanda.sla) === "continuo" || String(demanda.sla) === "24x7" ? "Contínuo" : "Padrão" },
                            { label: "Criado em", value: new Date(demanda.created_at).toLocaleString("pt-BR") },
                            ...(demandanteProfile ? [{ label: "Autor", value: demandanteProfile }] : []),
                            { label: "Prazo Máx. Início", value: demanda.originada_diagnostico ? "IMEDIATO" : demanda.prazo_inicio_atendimento ? new Date(demanda.prazo_inicio_atendimento).toLocaleString("pt-BR") : "—" },
                            { label: "Prazo Máx. Solução", value: demanda.prazo_solucao ? new Date(demanda.prazo_solucao).toLocaleString("pt-BR") : "Definido na OS" },
                            { label: "Previsão Encerramento", value: demanda.data_previsao_encerramento ? new Date(demanda.data_previsao_encerramento).toLocaleDateString("pt-BR") : "—" },
                            { label: "Atualizada em", value: new Date(demanda.updated_at).toLocaleDateString("pt-BR") },
                            ...((demanda.contador_rejeicoes ?? 0) > 0 ? [{ label: "Rejeições", value: `${demanda.contador_rejeicoes}x`, danger: true }] : []),
                          ].map((row: any) => (
                            <div key={row.label} className="flex justify-between gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                              <dt className="text-muted-foreground shrink-0 text-xs">{row.label}</dt>
                              <dd className={`font-medium text-right text-xs ${row.danger ? "text-rose-600" : ""}`}>{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {slaStatus.status !== "concluida" && slaStatus.status !== "sem_prazo" && (
                        <Card className={`border ${SLA_COR_CLASS[slaStatus.cor]}`}>
                          <CardContent className="px-4 py-3 space-y-2">
                            <p className="text-sm font-semibold">{slaStatus.label}</p>
                            {"percentConsumed" in slaStatus && <p className="text-xs">{(slaStatus.percentConsumed as number).toFixed(0)}% consumido</p>}
                            {"percentConsumed" in slaStatus && (
                              <div className="h-1.5 rounded-full bg-current/20">
                                <div className="h-1.5 rounded-full bg-current transition-all" style={{ width: `${Math.min(slaStatus.percentConsumed as number, 100)}%` }} />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                      {responsaveis.length > 0 && (
                        <div className="rounded-xl border overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                          <div className="px-4 py-2.5 border-b bg-muted/40">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Equipe Vinculada</p>
                          </div>
                          <div className="divide-y">
                            {responsaveis.map((r) => (
                              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                                <div
                                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                                  style={{ background: TEAL_BG, color: TEAL }}
                                >
                                  {getInitials(r.profile?.display_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{formatPersonName(r.profile?.display_name)}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{r.papel}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ─── ABA HISTÓRICO ─── */}
              <TabsContent value="historico" className="mt-5">
                {tLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {!tLoading && transitions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma transição registrada.</p>}
                {transitions.length > 0 && (
                  <div className="space-y-3">
                    {transitions.map((t, idx) => {
                      const isFirst = idx === 0;
                      return (
                        <div key={t.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div
                              className="h-2 w-2 rounded-full mt-1.5"
                              style={isFirst ? { background: TEAL } : { background: "hsl(var(--muted-foreground) / 0.4)" }}
                            />
                            {idx < transitions.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                          </div>
                          <div className="pb-3 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {t.from_status && (
                                <>
                                  <Badge variant="outline" className="text-[10px] h-5">{resolveLabel(t.from_status)}</Badge>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                </>
                              )}
                              <Badge className={`text-[10px] h-5 ${resolveColor(t.to_status)}`}>{resolveLabel(t.to_status)}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{new Date(t.created_at).toLocaleString("pt-BR")}</p>
                            {t.justificativa && <p className="text-xs italic text-muted-foreground mt-0.5">"{t.justificativa}"</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ─── ABA ATIVIDADES (HORAS) ─── */}
              <TabsContent value="horas" className="mt-5 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Total Acumulado: <span style={{ color: TEAL }}>{minutesToDisplay(total)}</span>
                  </p>
                </div>

                {/* Card lançar horas */}
                <div className="rounded-xl border overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="px-4 py-2.5 border-b bg-muted/40 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lançar Horas</p>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowFasesManager(true)}>
                        <Settings2 className="h-3.5 w-3.5" />Gerenciar Fases
                      </Button>
                    )}
                  </div>
                  <div className="px-4 py-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <Label className="text-xs">Data</Label>
                        <Input type="date" value={hourForm.data} max={todayISO()} onChange={(e) => setHourForm((p) => ({ ...p, data: e.target.value }))} className="w-40 mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Tempo (HH:MM)</Label>
                        <HorasInput value={hourForm.horas} onChange={(v) => setHourForm((p) => ({ ...p, horas: v }))} placeholder="00:00" className="w-28 mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Fase</Label>
                        <Select value={hourForm.fase} onValueChange={(v) => setHourForm((p) => ({ ...p, fase: v }))}>
                          <SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>{fases.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <Label className="text-xs">Descrição</Label>
                        <Input value={hourForm.descricao} onChange={(e) => setHourForm((p) => ({ ...p, descricao: e.target.value }))} className="mt-1" placeholder="Descreva a atividade..." />
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 text-white"
                        style={{ background: TEAL }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                        onClick={handleAddHour}
                      >
                        <Plus className="h-4 w-4" />Lançar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Lançado por: {profile?.display_name || user?.email || "Usuário"}
                    </p>
                  </div>
                </div>

                {hours.length > 0 && (() => {
                  const analistasOptions = buildAnalistasDedup(
                    Array.from(new Set(hours.map((h) => h.user_id))),
                    Array.from(profilesMap.entries()).map(([user_id, display_name]) => ({ user_id, display_name })),
                  );
                  const filteredHours = hours.filter((h) => {
                    const d = new Date(h.created_at);
                    if (hoursDataInicio) {
                      const ini = new Date(hoursDataInicio + "T00:00:00");
                      if (d < ini) return false;
                    }
                    if (hoursDataFim) {
                      const fim = new Date(hoursDataFim + "T23:59:59");
                      if (d > fim) return false;
                    }
                    if (!analistaMatches(hoursAnalista, h.user_id)) return false;
                    return true;
                  });
                  return (
                    <>
                      <ReportFilterBar
                        periodo={hoursPeriodo}
                        setPeriodo={setHoursPeriodo}
                        dataInicio={hoursDataInicio}
                        setDataInicio={setHoursDataInicio}
                        dataFim={hoursDataFim}
                        setDataFim={setHoursDataFim}
                        analista={hoursAnalista}
                        setAnalista={setHoursAnalista}
                        analistas={analistasOptions}
                        showAnalista={true}
                        totalFiltrado={filteredHours.length}
                        onClear={() => {
                          setHoursPeriodo("30");
                          setHoursDataInicio(hoursDaysAgo(30));
                          setHoursDataFim(hoursToday());
                          setHoursAnalista("all");
                        }}
                      />
                      <HoursTable
                        rows={filteredHours}
                        profilesMap={profilesMap}
                        fasesMap={fasesMap}
                        isAdmin={!!isAdmin}
                        minutesToDisplay={minutesToDisplay}
                        onEdit={(h) => { setEditHour(h); setShowEditHourDialog(true); }}
                        onDelete={(id) => setDeleteHourId(id)}
                      />
                    </>
                  );
                })()}
              </TabsContent>

              {/* ─── ABA RESPONSÁVEIS ─── */}
              <TabsContent value="responsaveis" className="mt-5 space-y-5">
                <p className="text-sm text-muted-foreground">Vincule um ou mais responsáveis à demanda.</p>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px] relative">
                    <Label className="text-xs">Buscar usuário</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Adicionar Responsável..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      O papel é preenchido automaticamente conforme o perfil do usuário.
                    </p>
                  </div>
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-xl divide-y overflow-hidden">
                    {searchResults.map((r) => (
                      <button
                        key={r.user_id}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3"
                        style={{ borderLeft: `3px solid transparent` }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderLeftColor = TEAL)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderLeftColor = "transparent")}
                        onClick={() => handleAddResp(r.user_id)}
                      >
                        <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm">{r.display_name}</span>
                        <span className="text-xs text-muted-foreground">{r.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {respLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {!respLoading && responsaveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum responsável vinculado.</p>}
                {responsaveis.length > 0 && (
                  <div className="rounded-xl border overflow-hidden divide-y" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    {responsaveis.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
                        style={{ borderLeft: `3px solid ${TEAL_BORDER}` }}
                      >
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                          style={{ background: TEAL_BG, color: TEAL }}
                        >
                          {getInitials(r.profile?.display_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{formatPersonName(r.profile?.display_name) || r.user_id}</p>
                          <p className="text-xs text-muted-foreground capitalize">{r.papel}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteRespId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ─── ABA EVIDÊNCIAS ─── */}
              <TabsContent value="evidencias" className="mt-5 space-y-5">
                {pendingTarget && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
                    <p className="font-medium text-amber-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Para avançar para "{resolveLabel(pendingTarget)}", cadastre ao menos uma evidência desta etapa e tente mover novamente.
                    </p>
                    {(() => {
                      const missing = getMissingEvidencias(pendingTarget);
                      const hasEvidence = missing.length === 0;
                      return hasEvidence ? (
                        <div className="mt-2 flex items-center gap-3">
                          <p className="text-emerald-700 text-xs">✅ Evidência registrada. Você já pode avançar.</p>
                          <Button
                            size="sm"
                            className="h-7 text-xs text-white"
                            style={{ background: TEAL }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                            onClick={async () => {
                              const ok = await onMoveTo(demanda, pendingTarget);
                              if (ok) { setPendingTarget(undefined); await refreshAllData(); }
                            }}
                          >
                            Avançar agora
                          </Button>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Card adicionar evidência */}
                <div className="rounded-xl border overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div className="px-4 py-2.5 border-b bg-muted/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar Evidência</p>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Fase</Label>
                        <Select value={evidForm.fase} onValueChange={(v) => setEvidForm((p) => ({ ...p, fase: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{allowedEvidFases.map((f) => <SelectItem key={f} value={f}>{EVIDENCIA_FASE_LABELS[f]}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select value={evidForm.tipo} onValueChange={(v) => setEvidForm((p) => ({ ...p, tipo: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="arquivo">Arquivo</SelectItem>
                            <SelectItem value="link">Link externo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input value={evidForm.titulo} onChange={(e) => setEvidForm((p) => ({ ...p, titulo: e.target.value }))} placeholder="Título da evidência" className="mt-1" />
                    </div>
                    {evidForm.tipo === "arquivo" ? (
                      <div><Label className="text-xs">Arquivo</Label><Input type="file" onChange={(e) => setEvidFile(e.target.files?.[0] || null)} className="mt-1" /></div>
                    ) : (
                      <div><Label className="text-xs">URL Externa</Label><Input value={evidForm.url_externa} onChange={(e) => setEvidForm((p) => ({ ...p, url_externa: e.target.value }))} placeholder="https://..." className="mt-1" /></div>
                    )}
                    <div>
                      <Label className="text-xs">Descrição (opcional)</Label>
                      <Textarea value={evidForm.descricao} onChange={(e) => setEvidForm((p) => ({ ...p, descricao: e.target.value }))} rows={2} className="mt-1" />
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 text-white"
                      style={{ background: TEAL }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                      onClick={handleAddEvidencia}
                    >
                      <Plus className="h-4 w-4" />Adicionar
                    </Button>
                  </div>
                </div>

                {EVIDENCIA_FASES.map((fase) => {
                  const items = evidenciasByFase[fase] || [];
                  if (items.length === 0) return null;
                  return (
                    <div key={fase}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{EVIDENCIA_FASE_LABELS[fase]}</p>
                      <div className="rounded-xl border overflow-hidden divide-y" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                        {items.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
                            style={{ borderLeft: `3px solid ${TEAL_BORDER}` }}
                          >
                            {e.tipo === "link" ? (
                              <Link2 className="h-4 w-4 shrink-0" style={{ color: TEAL }} />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{e.titulo}</p>
                              <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}{e.descricao ? ` — ${e.descricao}` : ""}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {e.tipo === "link" && e.url_externa && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-foreground" style={{ color: TEAL }} onClick={() => window.open(e.url_externa!, "_blank")}><Eye className="h-3.5 w-3.5" /></Button>
                              )}
                              {e.tipo === "arquivo" && e.file_path && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-foreground" style={{ color: TEAL }} onClick={async () => {
                                  try { const url = await evidSvc.getEvidenciaSignedUrl(e.file_path!); window.open(url, "_blank"); } catch { toast.error("Erro ao abrir arquivo"); }
                                }}><Upload className="h-3.5 w-3.5" /></Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteEvidId(e.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {evidencias.length === 0 && !evidLoading && <p className="text-sm text-muted-foreground">Nenhuma evidência registrada.</p>}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ─── MODAIS ─── */}
      <JustificativaDialog open={showJustModal} onClose={() => setShowJustModal(false)} onConfirm={confirmJustificativa} />
      <SuspensaoDialog
        open={showSuspensaoModal}
        onClose={() => { setShowSuspensaoModal(false); setNewStatus(""); }}
        onConfirm={confirmSuspensao}
      />
      <EncerramentoDialog
        open={showEncerramentoModal}
        onClose={() => { setShowEncerramentoModal(false); setNewStatus(""); }}
        onConfirm={confirmEncerramento}
        isCorretiva={isCorretiva}
      />
      <NovaAtividadeDialog
        demanda={demanda as Demanda}
        open={showEditHourDialog}
        onClose={() => { setShowEditHourDialog(false); setEditHour(null); }}
        editHour={editHour}
        onSuccess={reloadHours}
      />
      <ConfirmDialog
        open={!!deleteHourId}
        title="Remover lançamento?"
        description="Esta ação não pode ser desfeita."
        onConfirm={async () => {
          if (deleteHourId) {
            await removeHour(deleteHourId);
            setDeleteHourId(null);
            await reloadHours();
          }
        }}
        onOpenChange={() => setDeleteHourId(null)}
      />
      <ConfirmDialog
        open={!!deleteRespId}
        title="Remover responsável?"
        description="O responsável será desvinculado desta demanda."
        onConfirm={handleRemoveResp}
        onOpenChange={() => setDeleteRespId(null)}
      />
      <ConfirmDialog
        open={!!deleteEvidId}
        title="Remover evidência?"
        description="Esta ação não pode ser desfeita."
        onConfirm={handleRemoveEvidencia}
        onOpenChange={() => setDeleteEvidId(null)}
      />
      <Dialog open={showFasesManager} onOpenChange={setShowFasesManager}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Fases</DialogTitle>
            <DialogDescription>Cadastre as fases utilizadas no lançamento de horas das demandas. Mudanças aparecem em tempo real para todos os usuários.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Nova fase</Label>
                <Input value={newFaseLabel} onChange={(e) => setNewFaseLabel(e.target.value)} placeholder="Ex.: Reunião de Negócio" className="mt-1" />
              </div>
              <Button
                size="sm"
                className="text-white"
                style={{ background: TEAL }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#09a89d")}
                onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                onClick={async () => {
                  if (!newFaseLabel.trim()) return;
                  try { await createFase(newFaseLabel.trim()); setNewFaseLabel(""); toast.success("Fase criada"); }
                  catch (e: any) { toast.error(e?.message?.includes("duplicate") ? "Fase já existe" : "Erro ao criar fase"); }
                }}
              >
                <Plus className="h-4 w-4" />Adicionar
              </Button>
            </div>
            <div className="rounded-xl border overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fase</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fases.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs">{f.label}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={async () => {
                          try { await removeFase(f.id); toast.success("Fase removida"); } catch { toast.error("Erro ao remover"); }
                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowFasesManager(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

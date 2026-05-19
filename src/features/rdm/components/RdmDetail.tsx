import { useState, useEffect } from "react";
import {
  ArrowLeft, Calendar, Clock, Boxes, AlertTriangle,
  RefreshCw, Users, CheckSquare, ThumbsUp, History,
  Pencil, GitBranch, ClipboardList,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Rdm, RdmUpdate } from "../types/rdm";
import {
  RDM_STATUS_LABELS,
  RDM_TIPO_LABELS, RDM_AMBIENTE_LABELS,
} from "../types/rdm";
import { RdmStatusBadge }            from "./RdmStatusBadge";
import { RdmRiscoBadge }             from "./RdmRiscoBadge";
import { RdmChecklistPanel }         from "./RdmChecklistPanel";
import { RdmGoNogoPanel }            from "./RdmGoNogoPanel";
import { RdmParticipantesPanel }     from "./RdmParticipantesPanel";
import { RdmAuditLogPanel }          from "./RdmAuditLogPanel";
import { RdmSprintsPanel }           from "./RdmSprintsPanel";
import { RdmDeploymentTasksPanel }   from "./RdmDeploymentTasksPanel";
import { RdmForm }                   from "./RdmForm";
import { useAuth }                   from "@/contexts/AuthContext";

// Fluxo de transições válidas — alinhado com o CHECK do banco:
// status IN ('rascunho','em_aprovacao','aprovada','em_execucao',
//            'implantada','rollback_executado','cancelada')
const STATUS_TRANSITIONS: Record<string, string[]> = {
  rascunho:           ["em_aprovacao", "cancelada"],
  em_aprovacao:       ["aprovada", "cancelada", "rascunho"],
  aprovada:           ["em_execucao", "cancelada"],
  em_execucao:        ["implantada", "rollback_executado"],
  implantada:         [],
  rollback_executado: ["rascunho"],
  cancelada:          ["rascunho"],
};

// Formata data "YYYY-MM-DD" sem bug de timezone (UTC→local)
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString("pt-BR");
}

interface Props {
  rdm:      Rdm;
  onBack:   () => void;
  onUpdate: (id: string, updates: RdmUpdate) => Promise<void>;
}

export function RdmDetail({ rdm, onBack, onUpdate }: Props) {
  const { profile, isAdmin } = useAuth();
  const [updating, setUpdating]         = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [localRdm, setLocalRdm]         = useState<Rdm>(rdm);

  // Sincroniza localRdm quando a prop rdm mudar (ex: refresh do pai)
  useEffect(() => {
    setLocalRdm(rdm);
  }, [rdm]);

  const canEdit = isAdmin || localRdm.criado_por === profile?.id;

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      await onUpdate(localRdm.id, { status: newStatus });
      setLocalRdm((prev) => ({ ...prev, status: newStatus }));
    } finally {
      setUpdating(false);
    }
  };

  const handleEdit = async (
    values: Omit<RdmUpdate, "id" | "codigo" | "updated_at" | "team_id" | "criado_por">
  ) => {
    await onUpdate(localRdm.id, values);
    setLocalRdm((prev) => ({ ...prev, ...values }));
    setShowEditForm(false);
  };

  // Apenas transições válidas para o status atual
  const nextStatuses = STATUS_TRANSITIONS[localRdm.status] ?? [];

  return (
    <div className="space-y-5">
      {/* Topbar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex-1 min-w-0">
          {localRdm.codigo && (
            <p className="text-[10px] font-mono text-muted-foreground">{localRdm.codigo}</p>
          )}
          <h2 className="text-lg font-bold text-foreground truncate">{localRdm.nome}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RdmStatusBadge status={localRdm.status} />
          {canEdit && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
              onClick={() => setShowEditForm(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
        </div>
      </div>

      {/* Meta linha */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Boxes className="h-3 w-3" />{localRdm.sistema_modulo}
        </Badge>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDate(localRdm.data_implantacao)}
        </Badge>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Clock className="h-3 w-3" />
          {localRdm.hora_inicio} → {localRdm.hora_fim_prevista}
        </Badge>
        <Badge variant="outline" className="gap-1.5 text-xs">
          {RDM_TIPO_LABELS[localRdm.tipo_mudanca as keyof typeof RDM_TIPO_LABELS] ?? localRdm.tipo_mudanca}
        </Badge>
        <Badge variant="outline" className="gap-1.5 text-xs">
          {RDM_AMBIENTE_LABELS[localRdm.ambiente as keyof typeof RDM_AMBIENTE_LABELS] ?? localRdm.ambiente}
        </Badge>
        <RdmRiscoBadge risco={localRdm.risco} />
        {localRdm.downtime_previsto && (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" /> Downtime
          </Badge>
        )}
        {localRdm.rollback_previsto && (
          <Badge variant="outline" className="gap-1 text-xs">
            <RefreshCw className="h-3 w-3" />
            Rollback{localRdm.tempo_rollback_minutos ? ` ${localRdm.tempo_rollback_minutos}min` : ""}
          </Badge>
        )}
      </div>

      {/* Objetivo */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Objetivo</p>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{localRdm.objetivo}</p>
      </div>

      {/* Observações */}
      {localRdm.observacoes && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Observações</p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{localRdm.observacoes}</p>
        </div>
      )}

      {/* Transição de status */}
      {canEdit && nextStatuses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Mover para:</span>
          {nextStatuses.map((s) => (
            <Button key={s} variant="outline" size="sm" disabled={updating}
              onClick={() => handleStatusChange(s)} className="text-xs h-7">
              {RDM_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      )}

      {/* =====================================================
          ORDEM DAS ABAS — fluxo operacional da RDM:
          1. Checklist       — pré-requisitos e validações
          2. Sprints         — escopo técnico (sprints + redmines)
          3. Tarefas         — chamados operacionais de deploy
          4. Go/No-Go        — aprovação executiva
          5. Participantes   — equipe envolvida
          6. Histórico       — auditoria / rastreabilidade
          ===================================================== */}
      <Tabs defaultValue="checklist">
        <TabsList className="h-8 flex-wrap">
          <TabsTrigger value="checklist" className="text-xs gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" /> Checklist
          </TabsTrigger>
          <TabsTrigger value="sprints" className="text-xs gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> Sprints &amp; Redmines
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Tarefas
          </TabsTrigger>
          <TabsTrigger value="gonogo" className="text-xs gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5" /> Go/No-Go
          </TabsTrigger>
          <TabsTrigger value="participantes" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" /> Participantes
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs gap-1.5">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="mt-4">
          <RdmChecklistPanel rdmId={localRdm.id} />
        </TabsContent>

        <TabsContent value="sprints" className="mt-4">
          <RdmSprintsPanel rdmId={localRdm.id} />
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          <RdmDeploymentTasksPanel rdmId={localRdm.id} />
        </TabsContent>

        <TabsContent value="gonogo" className="mt-4">
          <RdmGoNogoPanel rdmId={localRdm.id} />
        </TabsContent>

        <TabsContent value="participantes" className="mt-4">
          <RdmParticipantesPanel rdmId={localRdm.id} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <RdmAuditLogPanel rdmId={localRdm.id} />
        </TabsContent>
      </Tabs>

      {/* Modal de edição */}
      <RdmForm
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        onSubmit={handleEdit}
        rdm={localRdm}
      />
    </div>
  );
}

import { Loader2, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar, AvatarFallback, AvatarImage,
} from "@/components/ui/avatar";
import { useRdmAuditLog } from "../hooks/useRdmAuditLog";

interface Props { rdmId: string }

// Labels amigáveis para campos do audit log
const CAMPO_LABELS: Record<string, string> = {
  status:                 "Status",
  nome:                   "Nome",
  objetivo:               "Objetivo",
  sistema_modulo:         "Sistema / Módulo",
  tipo_mudanca:           "Tipo de Mudança",
  risco:                  "Risco",
  ambiente:               "Ambiente",
  data_implantacao:       "Data de Implantação",
  hora_inicio:            "Hora Início",
  hora_fim_prevista:      "Hora Fim Prevista",
  downtime_previsto:      "Downtime Previsto",
  rollback_previsto:      "Rollback Previsto",
  tempo_rollback_minutos: "Tempo de Rollback (min)",
  observacoes:            "Observações",
  sprint_vinculada:       "Sprint Vinculada",
  chamado_operacional:    "Chamado Operacional",
  participante:           "Participante",
  deleted_at:             "Exclusão Lógica",
};

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) {
    return name.trim().split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  }
  if (email?.trim()) return email[0].toUpperCase();
  return "?";
}

function getDisplayName(profile: { display_name: string | null; email: string | null } | null, profileId: string): string {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.email?.trim())        return profile.email.trim();
  return profileId.slice(0, 8) + "…";
}

export function RdmAuditLogPanel({ rdmId }: Props) {
  const { logs, loading, loadingMore, hasMore, error, loadMore } = useRdmAuditLog(rdmId);

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <p className="text-sm text-destructive text-center py-6">{error}</p>
  );

  if (logs.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
      <Clock className="h-10 w-10 opacity-25" />
      <p className="text-sm">Nenhuma entrada no histórico</p>
    </div>
  );

  return (
    <div className="space-y-0">
      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

        {logs.map((log) => {
          const displayName = getDisplayName(log.profile, log.profile_id);
          const initials    = getInitials(log.profile?.display_name, log.profile?.email);

          return (
            <div key={log.id} className="relative flex gap-4 pb-5">
              {/* Ícone timeline */}
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-sidebar">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0 pt-1.5">
                {/* Campo alterado */}
                <p className="text-sm font-semibold text-foreground">
                  {CAMPO_LABELS[log.campo] ?? log.campo}
                </p>

                {/* Valor anterior → novo */}
                {(log.valor_anterior !== null || log.valor_novo !== null) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="line-through opacity-70">{log.valor_anterior ?? "—"}</span>
                    {" → "}
                    <span className="text-foreground font-medium">{log.valor_novo ?? "—"}</span>
                  </p>
                )}

                {/* Autor + timestamp */}
                <div className="flex items-center gap-2 mt-1.5">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={undefined} alt={displayName} />
                    <AvatarFallback className="text-[9px] font-semibold bg-primary/20 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[160px]"
                    title={log.profile?.email ?? log.profile_id}>
                    {displayName}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Paginação — Carregar mais */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ChevronDown className="h-3.5 w-3.5" />}
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}

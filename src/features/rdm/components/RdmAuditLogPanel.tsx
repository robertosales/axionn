import { Loader2, Clock } from "lucide-react";
import { useRdmAuditLog }  from "../hooks/useRdmAuditLog";

interface Props { rdmId: string }

export function RdmAuditLogPanel({ rdmId }: Props) {
  const { logs, loading, error } = useRdmAuditLog(rdmId);

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
    <div className="relative space-y-0">
      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

      {logs.map((log) => (
        <div key={log.id} className="relative flex gap-4 pb-5">
          <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-sidebar">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 pt-1.5">
            <p className="text-sm font-semibold text-foreground">
              {log.campo}
            </p>
            {(log.valor_anterior !== null || log.valor_novo !== null) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {log.valor_anterior ?? "—"}
                {" → "}
                <span className="text-foreground font-medium">{log.valor_novo ?? "—"}</span>
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {new Date(log.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ShieldAlert, ChevronDown, ChevronUp, Hash, Calendar, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImpedimentItem {
  id: string;
  reason: string;
  type: string;
  criticality: string;
  ticketId?: string;
  reportedAt: string;
  resolvedAt?: string;
  resolution?: string;
  huCode: string;
  huTitle: string;
}

const criticalityConfig: Record<string, { border: string; bg: string; badge: string; dot: string; label: string }> = {
  critica: {
    border: "border-l-destructive",
    bg: "bg-destructive/5",
    badge: "bg-destructive/15 text-destructive",
    dot: "bg-destructive animate-pulse",
    label: "Crítica",
  },
  alta: {
    border: "border-l-[#eab308]",
    bg: "bg-[#eab308]/5",
    badge: "bg-[#eab308]/15 text-[#eab308]",
    dot: "bg-[#eab308]",
    label: "Alta",
  },
  media: {
    border: "border-l-[#3b82f6]",
    bg: "bg-[#3b82f6]/5",
    badge: "bg-[#3b82f6]/15 text-[#3b82f6]",
    dot: "bg-[#3b82f6]",
    label: "Média",
  },
  baixa: {
    border: "border-l-muted-foreground",
    bg: "",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    label: "Baixa",
  },
};

function ImpedimentCard({ imp }: { imp: ImpedimentItem }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = criticalityConfig[imp.criticality] ?? criticalityConfig.baixa;
  const resolved = !!imp.resolvedAt;

  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 transition-shadow hover:shadow-sm",
        cfg.border,
        resolved ? "opacity-70" : cfg.bg,
      )}
    >
      {/* Cabeçalho sempre visível */}
      <button
        className="w-full text-left px-4 py-3.5 flex items-start gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Dot de criticidade */}
        <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", cfg.dot)} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-primary">{imp.huCode}</span>
            {imp.huTitle && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{imp.huTitle}</span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
            {imp.reason}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Badge
            className={cn("text-[10px] capitalize hidden sm:inline-flex", cfg.badge)}
            variant="outline"
          >
            {cfg.label}
          </Badge>
          {resolved ? (
            <Badge className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" variant="outline">
              <CheckCircle className="h-3 w-3" /> Resolvido
            </Badge>
          ) : (
            <Badge className="text-[10px] gap-1 bg-[#eab308]/15 text-[#eab308]" variant="outline">
              <ShieldAlert className="h-3 w-3" /> Ativo
            </Badge>
          )}
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Detalhes expandíveis */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <DetailItem icon={Wrench} label="Tipo" value={imp.type} />
            <DetailItem icon={ShieldAlert} label="Criticidade" value={cfg.label} />
            <DetailItem
              icon={Hash}
              label="Chamado"
              value={imp.ticketId || "—"}
            />
            <DetailItem
              icon={Calendar}
              label="Reportado em"
              value={new Date(imp.reportedAt).toLocaleDateString("pt-BR")}
            />
          </div>

          {resolved && imp.resolution && (
            <div className="mt-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                Resolução
              </p>
              <p className="text-sm text-foreground">{imp.resolution}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Resolvido em {new Date(imp.resolvedAt!).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="text-sm font-medium text-foreground capitalize">{value}</p>
    </div>
  );
}

export function ImpedimentHistoryPanel({ data }: { data: ImpedimentItem[] }) {
  const active = data.filter((i) => !i.resolvedAt);
  const resolved = data.filter((i) => !!i.resolvedAt);

  if (data.length === 0)
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-12 text-center">
        <CheckCircle className="h-14 w-14 mx-auto mb-3 text-emerald-500 opacity-50" />
        <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-base">
          Nenhum impedimento registrado nesta sprint.
        </p>
        <p className="text-sm text-muted-foreground mt-1">O time está livre de bloqueios!</p>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Ativos */}
      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pl-1">
            Ativos ({active.length})
          </p>
          <div className="space-y-2">
            {active.map((imp) => <ImpedimentCard key={imp.id} imp={imp} />)}
          </div>
        </section>
      )}

      {/* Resolvidos */}
      {resolved.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pl-1">
            Resolvidos ({resolved.length})
          </p>
          <div className="space-y-2">
            {resolved.map((imp) => <ImpedimentCard key={imp.id} imp={imp} />)}
          </div>
        </section>
      )}
    </div>
  );
}

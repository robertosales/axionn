import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, ArrowRight, GitBranch, AlertTriangle } from "lucide-react";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props {
  kpis: AdminKpis["global"];
}

export function ModuleQuickAccess({ kpis }: Props) {
  const navigate = useNavigate();

  const modules = [
    {
      key: "sala_agil",
      label: "Sala Ágil",
      description: "Kanban, planejamento de sprints, poker e retrospectivas.",
      icon: <Zap className="h-4 w-4 text-muted-foreground" />,
      badge: `${kpis.timesSalaAgil} time${kpis.timesSalaAgil !== 1 ? "s" : ""}`,
      alert:
        kpis.impedimentosAbertos > 0
          ? `${kpis.impedimentosAbertos} impedimento${kpis.impedimentosAbertos !== 1 ? "s" : ""}`
          : null,
      href: "/sala-agil",
    },
    {
      key: "sustentacao",
      label: "Sustentação",
      description: "Gestão de demandas RHM, SLA, IMR e relatórios contratuais.",
      icon: <Shield className="h-4 w-4 text-muted-foreground" />,
      badge: `${kpis.timesSustentacao} time${kpis.timesSustentacao !== 1 ? "s" : ""}`,
      alert: kpis.slaEmRisco > 0 ? `${kpis.slaEmRisco} SLA em risco` : null,
      href: "/sustentacao",
    },
    {
      key: "rdm",
      label: "RDM",
      description: "Gestão de mudanças, checklist e acompanhamento.",
      icon: <GitBranch className="h-4 w-4 text-muted-foreground" />,
      badge: "Mudanças",
      alert: null,
      href: "/rdm",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {modules.map((mod) => (
        <div
          key={mod.key}
          role="button"
          tabIndex={0}
          className="relative rounded-xl border border-border/50 bg-card p-4 shadow-sm transition-all cursor-pointer hover:border-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => navigate(mod.href)}
          onKeyDown={(e) => e.key === "Enter" && navigate(mod.href)}
        >
          {/* Seta discreta */}
          <ArrowRight className="absolute top-4 right-4 h-3.5 w-3.5 text-muted-foreground/30" />

          {/* Header */}
          <div className="flex items-center gap-2 mb-2 pr-6">
            {mod.icon}
            <span className="text-sm font-semibold">{mod.label}</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 ml-auto">
              {mod.badge}
            </Badge>
          </div>

          {/* Descrição completa sem corte */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {mod.description}
          </p>

          {/* Alerta como pill suave */}
          {mod.alert && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-destructive bg-destructive/8 rounded-md px-2.5 py-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {mod.alert}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

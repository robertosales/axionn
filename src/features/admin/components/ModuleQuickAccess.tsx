import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      icon: <Zap className="h-5 w-5 text-primary" />,
      badge: `${kpis.timesSalaAgil} time${kpis.timesSalaAgil !== 1 ? "s" : ""}`,
      alert:
        kpis.impedimentosAbertos > 0
          ? `${kpis.impedimentosAbertos} impedimento${kpis.impedimentosAbertos !== 1 ? "s" : ""}`
          : null,
      alertCls: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
      href: "/sala-agil",
      border: "border-primary/10 hover:border-primary/30",
    },
    {
      key: "sustentacao",
      label: "Sustentação",
      description: "Gestão de demandas RHM, SLA, IMR e relatórios contratuais.",
      icon: <Shield className="h-5 w-5 text-blue-600" />,
      badge: `${kpis.timesSustentacao} time${kpis.timesSustentacao !== 1 ? "s" : ""}`,
      alert: kpis.slaEmRisco > 0 ? `${kpis.slaEmRisco} SLA em risco` : null,
      alertCls: "bg-destructive/10 text-destructive dark:bg-red-950/40 dark:text-red-400",
      href: "/sustentacao",
      border: "border-blue-100 hover:border-blue-200",
    },
    {
      key: "rdm",
      label: "RDM",
      description: "Gestão de mudanças, checklist e acompanhamento.",
      icon: <GitBranch className="h-5 w-5 text-emerald-600" />,
      badge: "Mudanças",
      alert: null,
      alertCls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
      href: "/rdm",
      border: "border-emerald-100 hover:border-emerald-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      {modules.map((mod) => (
        <Card
          key={mod.key}
          className={`rounded-xl border shadow-sm transition-all cursor-pointer flex flex-col h-full hover:shadow-md ${mod.border}`}
          onClick={() => navigate(mod.href)}
        >
          <CardContent className="p-5 flex flex-col flex-1 gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted/30">
                  {mod.icon}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{mod.label}</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
                      {mod.badge}
                    </Badge>
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/30 mt-1" />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-2">
              {mod.description}
            </p>

            <div className="space-y-3">
              {mod.alert && (
                <div className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${mod.alertCls}`}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {mod.alert}
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="w-fit text-xs h-8 px-4 font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(mod.href);
                }}
              >
                Acessar módulo
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

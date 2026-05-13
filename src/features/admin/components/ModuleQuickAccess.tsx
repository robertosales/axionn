import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, ArrowRight } from "lucide-react";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props { kpis: AdminKpis["global"]; }

export function ModuleQuickAccess({ kpis }: Props) {
  const navigate = useNavigate();
  const modules = [
    {
      key: "sala_agil",
      label: "Sala Ágil",
      description: "Kanban, planejamento de sprints, planning poker e retrospectivas.",
      icon: <Zap className="h-6 w-6 text-primary" />,
      badge: `${kpis.timesSalaAgil} time${kpis.timesSalaAgil !== 1 ? "s" : ""}`,
      alert: kpis.impedimentosAbertos > 0 ? `${kpis.impedimentosAbertos} impedimento${kpis.impedimentosAbertos !== 1 ? "s" : ""} aberto${kpis.impedimentosAbertos !== 1 ? "s" : ""}` : null,
      alertCls: "bg-orange-50 text-orange-600",
      href: "/sala-agil",
      border: "border-primary/20 hover:border-primary/50",
    },
    {
      key: "sustentacao",
      label: "Sustentação",
      description: "Gestão de demandas RHM, SLA, IMR e relatórios contratuais.",
      icon: <Shield className="h-6 w-6 text-blue-600" />,
      badge: `${kpis.timesSustentacao} time${kpis.timesSustentacao !== 1 ? "s" : ""}`,
      alert: kpis.slaEmRisco > 0 ? `${kpis.slaEmRisco} SLA em risco` : null,
      alertCls: "bg-destructive/10 text-destructive",
      href: "/sustentacao",
      border: "border-blue-200 hover:border-blue-400",
    },
  ];
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Acesso Rápido</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.map(mod => (
          <Card key={mod.key} className={`rounded-xl border-2 transition-colors cursor-pointer ${mod.border}`} onClick={() => navigate(mod.href)}>
            <CardContent className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">{mod.icon}<span className="font-semibold">{mod.label}</span><Badge variant="secondary" className="text-[10px]">{mod.badge}</Badge></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">{mod.description}</p>
              {mod.alert && <div className={`text-[11px] font-medium px-2 py-1 rounded-md ${mod.alertCls}`}>⚠ {mod.alert}</div>}
              <Button size="sm" variant="outline" className="self-start text-xs h-7" onClick={e => { e.stopPropagation(); navigate(mod.href); }}>Acessar módulo</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

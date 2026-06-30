import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  GitBranch,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props {
  kpis: AdminKpis["global"];
}

interface ModuleCard {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  alert: string | null;
  href: string;
  tone: "agil" | "sust" | "neutral";
}

const TONE_STYLES = {
  agil: {
    accent: "border-l-teal-500",
    icon: "bg-teal-500/10 text-teal-600",
    badge: "border-teal-500/20 bg-teal-500/10 text-teal-700",
    hover: "hover:border-teal-500/35",
  },
  sust: {
    accent: "border-l-blue-500",
    icon: "bg-blue-500/10 text-blue-600",
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-700",
    hover: "hover:border-blue-500/35",
  },
  neutral: {
    accent: "border-l-slate-300 dark:border-l-slate-600",
    icon: "bg-muted text-muted-foreground",
    badge: "border-border bg-muted/70 text-foreground",
    hover: "hover:border-border",
  },
} as const;

export function ModuleQuickAccess({ kpis }: Props) {
  const navigate = useNavigate();

  const modules: ModuleCard[] = [
    {
      key: "sala_agil",
      label: "Sala Ágil",
      description: "Kanban, planejamento de sprints, poker e retrospectivas.",
      icon: Zap,
      badge: `${kpis.timesSalaAgil} time${kpis.timesSalaAgil !== 1 ? "s" : ""}`,
      alert:
        kpis.impedimentosAbertos > 0
          ? `${kpis.impedimentosAbertos} impedimento${kpis.impedimentosAbertos !== 1 ? "s" : ""}`
          : null,
      href: "/sala-agil",
      tone: "agil",
    },
    {
      key: "sustentacao",
      label: "Sustentação",
      description: "Gestão de demandas RHM, SLA, IMR e relatórios contratuais.",
      icon: Shield,
      badge: `${kpis.timesSustentacao} time${kpis.timesSustentacao !== 1 ? "s" : ""}`,
      alert: kpis.slaEmRisco > 0 ? `${kpis.slaEmRisco} SLA em risco` : null,
      href: "/sustentacao",
      tone: "sust",
    },
    {
      key: "rdm",
      label: "RDM",
      description: "Gestão de mudanças, checklist e acompanhamento.",
      icon: GitBranch,
      badge: "Mudanças",
      alert: null,
      href: "/rdm",
      tone: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {modules.map((module) => {
        const Icon = module.icon;
        const tone = TONE_STYLES[module.tone];

        return (
          <button
            key={module.key}
            type="button"
            className={`group relative min-h-[148px] rounded-2xl border border-l-2 border-border/70 ${tone.accent} bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone.hover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            onClick={() => navigate(module.href)}
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 pr-8">
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {module.label}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`ml-auto h-5 whitespace-nowrap px-2 text-[10px] font-semibold ${tone.badge}`}
                  >
                    {module.badge}
                  </Badge>
                </div>

                <p className="mt-2 max-w-[36ch] text-xs leading-5 text-muted-foreground">
                  {module.description}
                </p>

                {module.alert && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{module.alert}</span>
                  </div>
                )}
              </div>
            </div>

            <ArrowRight className="absolute right-4 top-5 h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </button>
        );
      })}
    </div>
  );
}

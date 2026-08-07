import type { ReactNode } from "react";
import { Bug, ClipboardCheck, ClipboardList, FolderTree, GitBranch, LayoutDashboard, PlayCircle } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const stages = [
  { label: "Visão geral", short: "Visão", route: "/sala-agil/qualidade", icon: LayoutDashboard },
  { label: "Casos de Teste", short: "Casos", route: "/sala-agil/qualidade/casos", icon: ClipboardCheck },
  { label: "Suítes", short: "Suítes", route: "/sala-agil/qualidade/suites", icon: FolderTree },
  { label: "Planos", short: "Planos", route: "/sala-agil/qualidade/planos", icon: ClipboardList },
  { label: "Execuções", short: "Execuções", route: "/sala-agil/qualidade/execucoes", icon: PlayCircle },
  { label: "Achados", short: "Achados", route: "/sala-agil/qualidade/achados", icon: Bug },
  { label: "Cobertura", short: "Cobertura", route: "/sala-agil/qualidade/cobertura", icon: GitBranch },
];

export function QualityWorkspaceShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-w-0 bg-gradient-to-b from-primary/[0.035] via-background to-background">
      <div className="mx-auto w-full max-w-[1500px] px-4 pt-4 md:px-8 md:pt-6">
        <div className="overflow-x-auto rounded-2xl border bg-card/90 p-1.5 shadow-sm backdrop-blur" aria-label="Jornada de qualidade">
          <nav className="flex min-w-max items-center gap-1">
            {stages.map((stage, index) => {
              const active = stage.route === "/sala-agil/qualidade"
                ? location.pathname === stage.route
                : location.pathname.startsWith(stage.route);
              const Icon = stage.icon;
              return (
                <div key={stage.route} className="flex items-center">
                  {index > 0 && <span className="mx-1 h-px w-3 bg-border md:w-6" aria-hidden="true" />}
                  <NavLink
                    to={stage.route}
                    end={stage.route === "/sala-agil/qualidade"}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="md:hidden">{stage.short}</span>
                    <span className="hidden md:inline">{stage.label}</span>
                  </NavLink>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}

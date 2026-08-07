import { BarChart3, Layers3, Target } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const OKR_SECTIONS = [
  {
    to: "/okr/dashboard",
    label: "Visão geral",
    icon: BarChart3,
  },
  {
    to: "/okr/ciclos",
    label: "Ciclos",
    icon: Layers3,
  },
  {
    to: "/okr/objectives",
    label: "Objetivos",
    icon: Target,
  },
] as const;

export function OkrSectionNav() {
  return (
    <nav aria-label="Navegação do OKR" className="w-full overflow-x-auto">
      <div className="grid min-w-max grid-cols-3 gap-1 rounded-xl border bg-muted/40 p-1 sm:inline-grid">
        {OKR_SECTIONS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

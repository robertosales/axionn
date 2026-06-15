// src/components/dashboard/DashboardTabs.tsx
// Barra de abas da Visão Geral — renderizada apenas para isAdminContrato.
// Segue o padrão visual do sistema: bg-card, border-border, text-foreground.

import { cn } from "@/lib/utils";
import { LayoutDashboard, Zap, Wrench } from "lucide-react";

export type DashboardTab = "global" | "agil" | "sustentacao";

interface DashboardTabsProps {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

const TABS: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
  { key: "global",      label: "Visão Global",  icon: LayoutDashboard },
  { key: "agil",        label: "Sala Ágil",     icon: Zap             },
  { key: "sustentacao", label: "Sustentação",   icon: Wrench          },
];

export function DashboardTabs({ active, onChange }: DashboardTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Módulo do dashboard"
      className="flex items-center gap-1 p-1 bg-muted/40 border border-border rounded-lg w-fit"
    >
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          aria-controls={`tabpanel-${key}`}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium",
            "transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary",
            active === key
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface ActionButton {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface BadgeInfo {
  label: string;
  icon?: LucideIcon;
  className?: string;
}

interface PageHeaderProps {
  /** Subtítulo / descrição da página */
  description?: string;
  /** Ícone que aparece antes do subtítulo */
  icon?: LucideIcon;
  /** Cor do ícone — Tailwind class, ex: "text-teal-400" */
  iconColor?: string;
  /** Badges opcionais ao lado do subtítulo */
  badges?: BadgeInfo[];
  /** Botões de ação no canto direito */
  actions?: ActionButton[];
  /** Slot livre para controles customizados (selects, filtros, etc.) */
  children?: React.ReactNode;
}

/**
 * PageHeader — cabeçalho padrão das páginas do Admin.
 *
 * O <h1> principal já é renderizado pelo AdminDashboard (topbar),
 * então este componente entrega apenas o subtítulo + ações.
 * Isso evita títulos duplicados e centraliza o layout em um único lugar.
 */
export function PageHeader({
  description,
  icon: Icon,
  iconColor = "text-muted-foreground",
  badges = [],
  actions = [],
  children,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      {/* Subtítulo + badges */}
      <div className="flex items-center gap-2 flex-wrap min-h-[1.5rem]">
        {Icon && (
          <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
        )}
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
        {badges.map((b, i) => {
          const BIcon = b.icon;
          return (
            <Badge
              key={i}
              variant="outline"
              className={b.className ?? "gap-1 text-[11px] font-medium"}
            >
              {BIcon && <BIcon className="h-3 w-3" />}
              {b.label}
            </Badge>
          );
        })}
      </div>

      {/* Ações + slot customizado */}
      {(actions.length > 0 || children) && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {children}
          {actions.map((a, i) => {
            const AIcon = a.icon;
            return (
              <Button
                key={i}
                size="sm"
                variant={a.variant ?? "default"}
                className="gap-1.5"
                onClick={a.onClick}
              >
                {AIcon && <AIcon className="h-4 w-4" />}
                {a.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

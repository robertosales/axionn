import { Button } from "@/components/ui/button";
import { PageHeader as SharedPageHeader } from "@/shared/components/common/PageHeader";
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
    <SharedPageHeader
      variant="admin"
      description={description}
      icon={Icon}
      iconClassName={`bg-transparent p-0 ${iconColor}`}
      badges={badges}
      actions={actions.length > 0 ? (
        <>
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
                {AIcon && <AIcon className="h-4 w-4" aria-hidden="true" />}
                {a.label}
              </Button>
            );
          })}
        </>
      ) : undefined}
    >
      {children}
    </SharedPageHeader>
  );
}

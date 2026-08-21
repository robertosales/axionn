import { useId, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export interface PageHeaderBadge {
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "secondary" | "outline" | "destructive";
  className?: string;
}

interface PageHeaderBaseProps {
  description?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  badges?: PageHeaderBadge[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type PageHeaderProps = PageHeaderBaseProps & (
  | {
      variant?: "operational";
      title: string;
      onBack?: () => void;
      backLabel?: string;
    }
  | {
      variant: "admin";
      title?: never;
      onBack?: never;
      backLabel?: never;
    }
);

export function PageHeader({
  variant = "operational",
  title,
  description,
  icon: Icon,
  iconClassName,
  badges = [],
  actions,
  children,
  className,
  onBack,
  backLabel = "Voltar",
}: PageHeaderProps) {
  const descriptionId = useId();
  const operational = variant === "operational";

  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        variant === "admin" && "mb-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {operational && onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 mt-0.5 shrink-0 gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Button>
        )}

        {Icon && (
          <span className={cn("mt-0.5 rounded-lg bg-primary/10 p-2 text-primary", iconClassName)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {operational && (
              <h1
                className="text-xl font-semibold tracking-tight sm:text-2xl"
                aria-describedby={description ? descriptionId : undefined}
              >
                {title}
              </h1>
            )}
            {badges.map((badge) => {
              const BadgeIcon = badge.icon;
              return (
                <Badge
                  key={badge.label}
                  variant={badge.variant ?? "outline"}
                  className={cn("gap-1 text-[11px] font-medium", badge.className)}
                >
                  {BadgeIcon && <BadgeIcon className="h-3 w-3" aria-hidden="true" />}
                  {badge.label}
                </Badge>
              );
            })}
          </div>
          {description && (
            <p id={descriptionId} className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      {(actions || children) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
          {actions}
        </div>
      )}
    </header>
  );
}

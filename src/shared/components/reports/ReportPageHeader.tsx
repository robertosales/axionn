import { ReactNode, ElementType } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportPageHeaderProps {
  /** Título principal do relatório */
  title?: string;
  /** @deprecated use title */
  titulo?: string;
  /** Descrição / subtítulo */
  description?: string;
  /** @deprecated use description */
  subtitulo?: string;
  /** Ícone — aceita ReactNode (JSX) ou um componente Lucide (ElementType) */
  icon?: ReactNode | ElementType;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  /** @deprecated ignorado — badge já cobre o módulo */
  modulo?: string;
  /** Label do período exibido como badge secundário */
  periodoLabel?: string;
  onBack?: () => void;
  onExportCSV?: () => void;
  extraActions?: ReactNode;
}

export function ReportPageHeader({
  title,
  titulo,
  description,
  subtitulo,
  icon,
  badge,
  badgeVariant = "secondary",
  periodoLabel,
  onBack,
  onExportCSV,
  extraActions,
}: ReportPageHeaderProps) {
  const resolvedTitle = title ?? titulo ?? "";
  const resolvedDesc  = description ?? subtitulo;

  // Suporte a LucideIcon (ElementType) passado diretamente como referência de componente
  const IconNode: ReactNode = icon
    ? typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in (icon as object))
      ? (() => { const Ic = icon as ElementType; return <Ic className="h-5 w-5" />; })()
      : (icon as ReactNode)
    : null;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mt-0.5 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {IconNode && <span className="text-primary">{IconNode}</span>}
            <h1 className="text-xl font-bold tracking-tight">{resolvedTitle}</h1>
            {badge && <Badge variant={badgeVariant} className="text-[11px]">{badge}</Badge>}
            {periodoLabel && (
              <Badge variant="outline" className={cn("text-[11px]", badge && "ml-0")}>{periodoLabel}</Badge>
            )}
          </div>
          {resolvedDesc && (
            <p className="text-sm text-muted-foreground">{resolvedDesc}</p>
          )}
        </div>
      </div>

      {(onExportCSV || extraActions) && (
        <div className="flex items-center gap-2 flex-wrap">
          {extraActions}
          {onExportCSV && (
            <Button variant="outline" size="sm" onClick={onExportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

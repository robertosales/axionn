import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";

interface ReportPageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  onBack?: () => void;
  onExportCSV?: () => void;
  extraActions?: ReactNode;
}

/**
 * Cabeçalho padrão de relatório com botão Voltar, badge de módulo e ações de exportação.
 */
export function ReportPageHeader({
  title,
  description,
  icon,
  badge,
  badgeVariant = "secondary",
  onBack,
  onExportCSV,
  extraActions,
}: ReportPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      {/* Lado esquerdo */}
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
            {icon && <span className="text-primary">{icon}</span>}
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            {badge && <Badge variant={badgeVariant} className="text-[11px]">{badge}</Badge>}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {/* Lado direito: ações */}
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

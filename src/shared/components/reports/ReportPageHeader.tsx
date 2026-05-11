import { ElementType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const MODULO_LABELS: Record<string, string> = {
  sustentacao: "Sustentação",
  agil: "Ágil",
  backlog: "Backlog",
};

interface ReportPageHeaderProps {
  // Interface nova (title/description/icon como ReactNode)
  title?: string;
  description?: string;
  icon?: ReactNode | ElementType;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  // Interface legada (titulo/subtitulo/modulo/periodoLabel)
  titulo?: string;
  subtitulo?: string;
  modulo?: string;
  periodoLabel?: string;
  // Ações
  onBack?: () => void;
  onExportCSV?: () => void;
  extraActions?: ReactNode;
}

export function ReportPageHeader({
  title,
  description,
  icon,
  badge,
  badgeVariant = "secondary",
  titulo,
  subtitulo,
  modulo,
  periodoLabel,
  onBack,
  onExportCSV,
  extraActions,
}: ReportPageHeaderProps) {
  // Resolve valores finais (legado tem prioridade se fornecido)
  const resolvedTitle = titulo ?? title ?? "";
  const resolvedDesc  = subtitulo ?? description;
  const resolvedBadge = badge ?? (modulo ? MODULO_LABELS[modulo] ?? modulo : undefined);

  // Renderiza o ícone: pode ser ElementType (componente Lucide) ou ReactNode (JSX)
  let iconNode: ReactNode = null;
  if (icon) {
    if (typeof icon === "function" || (typeof icon === "object" && "$$typeof" in (icon as object) && !!(icon as { $$typeof: unknown }).$$typeof === false)) {
      // é um ElementType (componente)
      const IconComp = icon as ElementType;
      iconNode = <IconComp className="h-5 w-5" />;
    } else {
      iconNode = icon as ReactNode;
    }
  }

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
            {iconNode && <span className="text-primary">{iconNode}</span>}
            <h1 className="text-xl font-bold tracking-tight">{resolvedTitle}</h1>
            {resolvedBadge && (
              <Badge variant={badgeVariant} className="text-[11px]">{resolvedBadge}</Badge>
            )}
          </div>
          {resolvedDesc && (
            <p className="text-sm text-muted-foreground">{resolvedDesc}</p>
          )}
          {periodoLabel && (
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
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

import { ReactNode } from "react";

interface ReportLayoutProps {
  // Props nomeadas usadas pelos relatórios
  header?: ReactNode;
  filters?: ReactNode;
  kpis?: ReactNode;
  table?: ReactNode;
  chart?: ReactNode;
  footer?: ReactNode;
  // Alternativa: children direto
  children?: ReactNode;
  /** largura máxima da área de conteúdo (default: max-w-7xl) */
  maxWidth?: string;
}

/**
 * Wrapper profissional usado por todos os relatórios.
 * Aceita tanto props nomeadas (header/filters/kpis/table/footer)
 * quanto children direto para retrocompatibilidade.
 */
export function ReportLayout({
  header,
  filters,
  kpis,
  chart,
  table,
  footer,
  children,
  maxWidth = "max-w-7xl",
}: ReportLayoutProps) {
  // Modo children (legado)
  if (children && !header && !table) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className={`${maxWidth} mx-auto px-4 md:px-6 py-6 space-y-6`}>
          {children}
        </div>
      </div>
    );
  }

  // Modo props nomeadas
  return (
    <div className="min-h-screen bg-muted/30">
      <div className={`${maxWidth} mx-auto px-4 md:px-6 py-6 space-y-6`}>
        {header  && <div>{header}</div>}
        {filters && <div>{filters}</div>}
        {kpis    && <div>{kpis}</div>}
        {chart   && <div>{chart}</div>}
        {table   && <div>{table}</div>}
        {footer  && <div>{footer}</div>}
        {children}
      </div>
    </div>
  );
}

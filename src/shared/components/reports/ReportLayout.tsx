import { ReactNode } from "react";

interface ReportLayoutProps {
  children: ReactNode;
  /** largura máxima da área de conteúdo (default: max-w-7xl) */
  maxWidth?: string;
}

/**
 * Wrapper profissional usado por todos os relatórios.
 * Garante padding, scroll seguro e fundo neutro consistente.
 */
export function ReportLayout({ children, maxWidth = "max-w-7xl" }: ReportLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className={`${maxWidth} mx-auto px-4 md:px-6 py-6 space-y-6`}>
        {children}
      </div>
    </div>
  );
}

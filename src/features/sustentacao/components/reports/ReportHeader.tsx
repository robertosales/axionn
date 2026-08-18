import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { FileText } from "lucide-react";

interface ReportHeaderProps {
  tipoRelatorio: string;
  periodo: string;
  modulo?: string;
}

const PERIODO_LABELS: Record<string, string> = {
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
  'all': 'Todos os períodos',
};

export function ReportHeader({ tipoRelatorio, periodo, modulo = 'Sustentação' }: ReportHeaderProps) {
  const { profile } = useAuth();
  const now = new Date();
  const docId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-info" />
          <span className="text-sm font-semibold">{tipoRelatorio}</span>
          <Badge variant="outline" className="text-[10px]">{modulo}</Badge>
          <Badge variant="secondary" className="text-[10px]">Interno</Badge>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{docId}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
        <span>Período: <strong className="text-foreground">{PERIODO_LABELS[periodo] || periodo}</strong></span>
        <span>Gerado por: <strong className="text-foreground">{profile?.display_name || 'Sistema'}</strong></span>
        <span>Data: <strong className="text-foreground">{now.toLocaleDateString('pt-BR')} {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
      </div>
    </div>
  );
}

export function ReportLegend({ items }: { items: Array<{ sigla: string; descricao: string }> }) {
  return (
    <div className="border rounded-lg bg-muted/30 p-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legenda</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {items.map(i => (
          <span key={i.sigla} className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">{i.sigla}</strong> — {i.descricao}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * SLAAlertToast
 * Componente visual usado como `icon` ou `description` em toasts de SLA.
 * Também exporta helpers para disparar toasts SLA de forma manual,
 * ex: ao abrir uma demanda que já está violada.
 */
import { toast } from 'sonner';
import { ShieldAlert, ShieldX, ShieldCheck } from 'lucide-react';

export type SlaLevel = 'em_risco' | 'violado' | 'normalizado';

const CFG: Record<SlaLevel, {
  title:   (rhm: string) => string;
  desc:    string;
  icon:    React.ReactNode;
  style:   React.CSSProperties;
  duration: number;
}> = {
  em_risco: {
    title:    (rhm) => `SLA em Risco — ${rhm}`,
    desc:     'Esta demanda está próxima de violar o prazo SLA.',
    icon:     <ShieldAlert className="h-4 w-4 text-amber-500" />,
    style:    { borderLeft: '3px solid #f59e0b' },
    duration: 8000,
  },
  violado: {
    title:    (rhm) => `SLA Violado — ${rhm}`,
    desc:     'O prazo SLA desta demanda foi ultrapassado.',
    icon:     <ShieldX className="h-4 w-4 text-red-500" />,
    style:    { borderLeft: '3px solid #ef4444' },
    duration: 12_000,
  },
  normalizado: {
    title:    (rhm) => `SLA Normalizado — ${rhm}`,
    desc:     'A demanda voltou a estar dentro do prazo SLA.',
    icon:     <ShieldCheck className="h-4 w-4 text-emerald-500" />,
    style:    { borderLeft: '3px solid #10b981' },
    duration: 5000,
  },
};

/** Dispara toast SLA manualmente (ex: ao detectar status no carregamento) */
export function fireSLAToast(level: SlaLevel, rhm: string) {
  const cfg = CFG[level];
  toast(cfg.title(rhm), {
    description: cfg.desc,
    duration:    cfg.duration,
    style:       cfg.style,
    icon:        cfg.icon,
  });
}

/** Preview visual do toast (usado em StorybookA ou página de demo) */
export function SLAAlertToastPreview({ level, rhm }: { level: SlaLevel; rhm: string }) {
  const cfg = CFG[level];
  return (
    <div
      className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-md text-sm"
      style={cfg.style}
    >
      <span className="mt-0.5 shrink-0">{cfg.icon}</span>
      <div>
        <p className="font-semibold">{cfg.title(rhm)}</p>
        <p className="text-xs text-muted-foreground">{cfg.desc}</p>
      </div>
    </div>
  );
}

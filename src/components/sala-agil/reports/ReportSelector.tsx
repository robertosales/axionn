import { REPORT_META, ReportType } from './types';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  indigo:  'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300',
  violet:  'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-300',
  red:     'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300',
  purple:  'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300',
  blue:    'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
  amber:   'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
};

interface Props {
  selected: ReportType | null;
  onSelect: (type: ReportType) => void;
}

export function ReportSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
      {REPORT_META.map((r) => (
        <button
          key={r.type}
          onClick={() => onSelect(r.type)}
          className={cn(
            'flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
            selected === r.type
              ? COLOR_MAP[r.color] + ' shadow-md ring-2 ring-offset-1'
              : 'bg-card border-border hover:border-muted-foreground/40'
          )}
        >
          <span className="text-2xl">{r.icon}</span>
          <span className="text-sm font-semibold leading-tight">{r.title}</span>
          <span className="text-xs text-muted-foreground leading-snug">{r.description}</span>
          <span className="mt-auto text-[10px] font-medium uppercase tracking-wide opacity-60">{r.audience}</span>
        </button>
      ))}
    </div>
  );
}

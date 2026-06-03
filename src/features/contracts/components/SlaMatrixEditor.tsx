import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { SlaRow, SLAPriority } from '../types/contract';
import { PRIORITY_CONFIG } from '../types/contract';

interface Props {
  slas: SlaRow[];
  onChange: (slas: SlaRow[]) => void;
}

export function SlaMatrixEditor({ slas, onChange }: Props) {
  function updateSla(priority: SLAPriority, field: keyof SlaRow, value: any) {
    onChange(slas.map((s) => (s.priority === priority ? { ...s, [field]: value } : s)));
  }

  const businessHoursOnly = slas[0]?.business_hours_only ?? true;

  return (
    <div className="space-y-4">

      {/* Aviso */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
        <strong>Atenção:</strong> Ao salvar, estas regras substituem qualquer SLA fixado no código
        para chamados desta sala de sustentação.
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prioridade</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">1ª Resposta (min)</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resolução (horas)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {slas.map((sla) => {
              const cfg = PRIORITY_CONFIG[sla.priority as SLAPriority];
              return (
                <tr key={sla.priority} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cfg.bgColor} shrink-0`} />
                      <span className="text-xs font-medium">{cfg.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={sla.response_time_minutes}
                        onChange={(e) =>
                          updateSla(sla.priority as SLAPriority, 'response_time_minutes', Number(e.target.value))
                        }
                        className="w-20 h-8 text-center text-xs"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={Math.round(sla.resolution_time_minutes / 60)}
                        onChange={(e) =>
                          updateSla(
                            sla.priority as SLAPriority,
                            'resolution_time_minutes',
                            Number(e.target.value) * 60,
                          )
                        }
                        className="w-20 h-8 text-center text-xs"
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toggle horário comercial */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div>
          <Label className="text-sm font-medium">Apenas Horário Comercial (8×5)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pausa a contagem de SLA fora do expediente e feriados.
          </p>
        </div>
        <Switch
          checked={businessHoursOnly}
          onCheckedChange={(checked) =>
            onChange(slas.map((s) => ({ ...s, business_hours_only: checked })))
          }
        />
      </div>
    </div>
  );
}

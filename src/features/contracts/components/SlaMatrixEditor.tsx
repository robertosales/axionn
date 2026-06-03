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
      <div className="p-3 bg-amber-950/20 border border-amber-900/50 text-amber-300 text-xs rounded-lg flex items-start gap-2">
        <span>⚠️</span>
        <p>
          Ao salvar, estas regras substituem qualquer SLA fixado no código para
          chamados desta sala de sustentação.
        </p>
      </div>

      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Prioridade</th>
              <th className="px-4 py-3 text-left font-semibold">1ª Resposta (min)</th>
              <th className="px-4 py-3 text-left font-semibold">Resolução (horas)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {slas.map((sla) => {
              const cfg = PRIORITY_CONFIG[sla.priority as SLAPriority];
              return (
                <tr key={sla.priority} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.bgColor} shrink-0`} />
                      <span className="font-medium text-white text-xs">{cfg.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={sla.response_time_minutes}
                        onChange={(e) =>
                          updateSla(sla.priority as SLAPriority, 'response_time_minutes', Number(e.target.value))
                        }
                        className="w-20 bg-slate-950 border border-slate-700 text-center rounded p-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-xs">min</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={Math.round(sla.resolution_time_minutes / 60)}
                        onChange={(e) =>
                          updateSla(
                            sla.priority as SLAPriority,
                            'resolution_time_minutes',
                            Number(e.target.value) * 60
                          )
                        }
                        className="w-20 bg-slate-950 border border-slate-700 text-center rounded p-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-xs">h</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toggle horário comercial */}
      <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
        <div>
          <p className="text-sm font-medium text-white">Apenas Horário Comercial (8×5)</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Pausa a contagem de SLA fora do expediente e feriados.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={businessHoursOnly}
            onChange={(e) =>
              onChange(slas.map((s) => ({ ...s, business_hours_only: e.target.checked })))
            }
          />
          <div
            className="w-11 h-6 bg-slate-700 rounded-full peer
              peer-checked:bg-indigo-600
              after:content-[''] after:absolute after:top-0.5 after:left-[2px]
              after:bg-white after:rounded-full after:h-5 after:w-5
              after:transition-all peer-checked:after:translate-x-full"
          />
        </label>
      </div>
    </div>
  );
}

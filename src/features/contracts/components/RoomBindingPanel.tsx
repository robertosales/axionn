import { useEffect, useState } from 'react';
import { fetchFreeTeams } from '../services/contracts.service';
import type { TeamConfig } from '../types/contract';

interface Props {
  title: string;
  accentColor: 'indigo' | 'purple';
  config: TeamConfig;
  onChange: (c: TeamConfig) => void;
}

export function RoomBindingPanel({ title, accentColor, config, onChange }: Props) {
  const [freeTeams, setFreeTeams] = useState<{ id: string; name: string; module: string }[]>([]);

  useEffect(() => {
    fetchFreeTeams().then(setFreeTeams).catch(() => {});
  }, []);

  const accent =
    accentColor === 'indigo'
      ? {
          border: 'border-indigo-600',
          text: 'text-indigo-400',
          activeBg: 'bg-indigo-950/20 border-indigo-900/50',
        }
      : {
          border: 'border-purple-600',
          text: 'text-purple-400',
          activeBg: 'bg-purple-950/20 border-purple-900/50',
        };

  return (
    <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
      <div>
        <h4 className={`text-sm font-bold ${accent.text}`}>{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Vincule um time existente ou provisione uma nova estrutura do zero.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Opção: vincular existente */}
        <label
          className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
            config.mode === 'link_existing'
              ? `${accent.activeBg} ${accent.border}`
              : 'bg-slate-900 border-slate-800 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            <input
              type="radio"
              checked={config.mode === 'link_existing'}
              onChange={() => onChange({ ...config, mode: 'link_existing' })}
              className="accent-indigo-600"
            />
            <span className="text-white">Vincular Time Existente</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Preserva histórico, quadros e dados legados intactos.
          </p>
          {config.mode === 'link_existing' && (
            <select
              className="mt-3 w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 focus:outline-none"
              value={config.existingTeamId ?? ''}
              onChange={(e) => onChange({ ...config, existingTeamId: e.target.value })}
            >
              <option value="">Selecione um time...</option>
              {freeTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </label>

        {/* Opção: provisionar novo */}
        <label
          className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
            config.mode === 'provision_new'
              ? `${accent.activeBg} ${accent.border}`
              : 'bg-slate-900 border-slate-800 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            <input
              type="radio"
              checked={config.mode === 'provision_new'}
              onChange={() => onChange({ ...config, mode: 'provision_new' })}
              className="accent-indigo-600"
            />
            <span className="text-emerald-400">✨ Provisionar Novo Time</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Estrutura limpa. Configure membros, fluxos e Kanban do zero.
          </p>
          {config.mode === 'provision_new' && (
            <input
              type="text"
              placeholder="Nome do novo time..."
              className="mt-3 w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              value={config.newTeamName ?? ''}
              onChange={(e) => onChange({ ...config, newTeamName: e.target.value })}
            />
          )}
        </label>
      </div>
    </div>
  );
}

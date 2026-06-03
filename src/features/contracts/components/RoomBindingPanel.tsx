import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchFreeTeams } from '../services/contracts.service';
import type { TeamConfig } from '../types/contract';

interface Props {
  title: string;
  accentColor: 'indigo' | 'purple';
  config: TeamConfig;
  onChange: (c: TeamConfig) => void;
}

export function RoomBindingPanel({ title, config, onChange }: Props) {
  const [freeTeams, setFreeTeams] = useState<{ id: string; name: string; module: string }[]>([]);

  useEffect(() => {
    fetchFreeTeams().then(setFreeTeams).catch(() => {});
  }, []);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Vincule um time existente ou provisione uma nova estrutura do zero.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Vincular existente */}
        <label
          className={[
            'flex flex-col p-3 rounded-lg border cursor-pointer transition-colors',
            config.mode === 'link_existing'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/40',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              checked={config.mode === 'link_existing'}
              onChange={() => onChange({ ...config, mode: 'link_existing' })}
              className="accent-primary"
            />
            Vincular Existente
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Preserva histórico, quadros e dados legados.
          </p>
          {config.mode === 'link_existing' && (
            <div className="mt-2">
              <Select
                value={config.existingTeamId ?? ''}
                onValueChange={(v) => onChange({ ...config, existingTeamId: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione um time..." />
                </SelectTrigger>
                <SelectContent>
                  {freeTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </label>

        {/* Provisionar novo */}
        <label
          className={[
            'flex flex-col p-3 rounded-lg border cursor-pointer transition-colors',
            config.mode === 'provision_new'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/40',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              checked={config.mode === 'provision_new'}
              onChange={() => onChange({ ...config, mode: 'provision_new' })}
              className="accent-primary"
            />
            Provisionar Novo
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Estrutura limpa. Configure membros e fluxos do zero.
          </p>
          {config.mode === 'provision_new' && (
            <div className="mt-2">
              <Input
                placeholder="Nome do novo time..."
                className="h-8 text-xs"
                value={config.newTeamName ?? ''}
                onChange={(e) => onChange({ ...config, newTeamName: e.target.value })}
              />
            </div>
          )}
        </label>
      </div>
    </div>
  );
}

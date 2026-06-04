import { useEffect, useState } from 'react';
import { Search, X, Filter, Zap, Wrench, Shuffle } from 'lucide-react';
import { Input }  from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge }  from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchActiveContracts } from '@/features/contracts/services/contracts.service';

export interface KanbanFilterState {
  search:       string;
  priority:     string;   // '' | 'high' | 'medium' | 'low'
  assignee:     string;   // '' | nome
  contractId:   string;   // '' | uuid  — NOVO: filtro por contrato
  roomMode:     string;   // '' | 'agil' | 'sustentacao' | 'hibrido' — NOVO
}

const INITIAL: KanbanFilterState = {
  search: '', priority: '', assignee: '', contractId: '', roomMode: '',
};

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'Alta',   className: 'text-red-400'    },
  { value: 'medium', label: 'Média',  className: 'text-yellow-400' },
  { value: 'low',    label: 'Baixa',  className: 'text-green-400'  },
];

const ROOM_MODE_OPTIONS = [
  { value: 'agil',        label: 'Ágil',              icon: <Zap    className="h-3 w-3" /> },
  { value: 'sustentacao', label: 'Sustentação',     icon: <Wrench  className="h-3 w-3" /> },
  { value: 'hibrido',     label: 'Ágil + Sustentação', icon: <Shuffle className="h-3 w-3" /> },
];

interface Props {
  filters:   KanbanFilterState;
  onChange:  (f: KanbanFilterState) => void;
  assignees?: string[];
}

export function KanbanFilters({ filters, onChange, assignees = [] }: Props) {
  const [contracts, setContracts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchActiveContracts()
      .then(setContracts)
      .catch(() => setContracts([]));
  }, []);

  function set<K extends keyof KanbanFilterState>(key: K, value: KanbanFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  const hasFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="flex flex-wrap items-center gap-2">

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-8 w-44 text-xs"
          placeholder="Buscar card..."
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </div>

      {/* Prioridade */}
      <Select
        value={filters.priority || '_all'}
        onValueChange={v => set('priority', v === '_all' ? '' : v)}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas</SelectItem>
          {PRIORITY_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>
              <span className={o.className}>{o.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Responsável */}
      {assignees.length > 0 && (
        <Select
          value={filters.assignee || '_all'}
          onValueChange={v => set('assignee', v === '_all' ? '' : v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {assignees.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Contrato (NOVO — HU-001 RN02) */}
      {contracts.length > 0 && (
        <Select
          value={filters.contractId || '_all'}
          onValueChange={v => set('contractId', v === '_all' ? '' : v)}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos contratos</SelectItem>
            {contracts.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Modalidade (NOVO — HU-001 RN02) */}
      <Select
        value={filters.roomMode || '_all'}
        onValueChange={v => set('roomMode', v === '_all' ? '' : v)}
      >
        <SelectTrigger className="h-8 w-40 text-xs">
          <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Modalidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas modalidades</SelectItem>
          {ROOM_MODE_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>
              <span className="flex items-center gap-1.5">{o.icon}{o.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Limpar filtros */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={() => onChange(INITIAL)}
        >
          <X className="h-3 w-3" /> Limpar
          <Badge variant="secondary" className="ml-0.5 text-[9px] px-1">
            {Object.values(filters).filter(v => v !== '').length}
          </Badge>
        </Button>
      )}
    </div>
  );
}

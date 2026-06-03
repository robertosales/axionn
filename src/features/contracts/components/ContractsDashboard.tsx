import { useState } from 'react';
import { FileText, Plus, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useContracts } from '../hooks/useContracts';
import { CONTRACT_STATUS_CONFIG } from '../types/contract';
import type { Contract, ContractStatus } from '../types/contract';
import { ContractForm } from './ContractForm';
import { ContractDetail } from './ContractDetail';

export function ContractsDashboard() {
  const { contracts, loading, reload } = useContracts();
  const [showForm, setShowForm]     = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active  = contracts.filter((c) => c.status === 'active').length;
  const paused  = contracts.filter((c) => c.status === 'paused').length;

  const metrics = [
    { label: 'Contratos Ativos',  value: active,            icon: <CheckCircle2  className="h-4 w-4" /> },
    { label: 'Pausados',          value: paused,            icon: <Clock         className="h-4 w-4" /> },
    { label: 'Alertas Críticos',  value: 0,                 icon: <AlertTriangle className="h-4 w-4" /> },
    { label: 'Total',             value: contracts.length,  icon: <FileText      className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">

      {/* Header — igual ao AdminTimesPage */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Gestão de Contratos</h2>
          <p className="text-xs text-muted-foreground">
            {loading
              ? 'Carregando...'
              : `${contracts.length} contrato${contracts.length !== 1 ? 's' : ''} cadastrado${contracts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Novo Contrato
        </Button>
      </div>

      {/* KPI cards — neutros, sem cores de fundo, igual ao padrão */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              {m.icon}
              <span>{m.label}</span>
            </div>
            <p className="text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Contratos</span>
          <Badge variant="secondary" className="text-xs">{contracts.length}</Badge>
        </div>

        {loading ? (
          <Skeleton className="h-48 w-full rounded-b-lg" />
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum contrato cadastrado.</p>
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeiro contrato
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {['Contrato', 'Status', 'Vigência', 'SLAs', 'Ações'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {contracts.map((c: Contract) => {
                const statusCfg = CONTRACT_STATUS_CONFIG[c.status as ContractStatus];
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.starts_at ? new Date(c.starts_at).toLocaleDateString('pt-BR') : '—'}
                      {' → '}
                      {c.ends_at ? new Date(c.ends_at).toLocaleDateString('pt-BR') : 'Indeterminado'}
                    </td>
                    <td className="px-4 py-3">
                      {c.contract_slas && c.contract_slas.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {c.contract_slas.length} prioridade{c.contract_slas.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem SLA</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setSelectedId(c.id)}
                      >
                        Configurar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ContractForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); reload(); }}
        />
      )}

      {selectedId && (
        <ContractDetail
          contractId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={reload}
        />
      )}
    </div>
  );
}

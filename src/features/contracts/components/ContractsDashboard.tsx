import { useState } from 'react';
import { Plus, Settings, RefreshCw, ShieldCheck, Zap, Wrench, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContracts } from '../hooks/useContracts';
import { ContractForm } from './ContractForm';
import { ContractDetail } from './ContractDetail';
import { SLACompliancePanel } from './SLACompliancePanel';
import { CONTRACT_STATUS_CONFIG, ROOM_MODE_CONFIG } from '../types/contract';
import type { ContractStatus, RoomMode } from '../types/contract';

export function ContractsDashboard() {
  const { contracts, loading, reload } = useContracts();
  const [showForm,          setShowForm]          = useState(false);
  const [selectedContract,  setSelectedContract]  = useState<string | null>(null);
  const [expandedSLA,       setExpandedSLA]       = useState<string | null>(null);

  // D — KPIs por modalidade
  const total      = contracts.length;
  const ativos     = contracts.filter((c: any) => c.status === 'active').length;
  const pausados   = contracts.filter((c: any) => c.status === 'paused').length;
  const comSLA     = contracts.filter((c: any) =>
    c.room_mode === 'sustentacao' || c.room_mode === 'hibrido'
  ).length;

  function toggleSLA(contractId: string) {
    // Só expande SLA para contratos com sustentação
    setExpandedSLA(prev => prev === contractId ? null : contractId);
  }

  const ROOM_ICON: Record<string, React.ReactNode> = {
    agil:        <Zap    className="h-3 w-3" />,
    sustentacao: <Wrench className="h-3 w-3" />,
    hibrido:     <Shuffle className="h-3 w-3" />,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Gestão de Contratos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} contrato{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-8 gap-1" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo Contrato
          </Button>
        </div>
      </div>

      {/* D — KPI cards com breakdown por modalidade */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contratos Ativos</p>
          <p className="text-2xl font-bold mt-1">{ativos}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pausados</p>
          <p className="text-2xl font-bold mt-1 text-yellow-400">{pausados}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Com SLA</p>
          <p className="text-2xl font-bold mt-1 text-purple-400">{comSLA}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-2xl font-bold mt-1">{total}</p>
        </div>
      </div>

      {/* Tabela de contratos */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Contrato</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Modalidade</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Vigência</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">SLAs</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && contracts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Nenhum contrato cadastrado.
                </td>
              </tr>
            )}
            {contracts.map((contract: any) => {
              const statusCfg = CONTRACT_STATUS_CONFIG[contract.status as ContractStatus];
              const roomMode  = (contract.room_mode ?? 'sustentacao') as RoomMode;
              const roomCfg   = ROOM_MODE_CONFIG[roomMode];
              const hasSLA    = roomCfg?.hasSLA ?? true;
              const slaCount  = contract.contract_slas?.length ?? 0;
              const isExpanded = expandedSLA === contract.id;

              return (
                <>
                  <tr
                    key={contract.id}
                    className={[
                      'hover:bg-muted/30 transition-colors',
                      hasSLA ? 'cursor-pointer' : 'cursor-default',
                      isExpanded ? 'bg-muted/20' : '',
                    ].join(' ')}
                    onClick={() => hasSLA && toggleSLA(contract.id)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{contract.name}</p>
                        {contract.description && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {contract.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${statusCfg.className}`}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    {/* D — Badge de modalidade */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {roomCfg && (
                        <Badge variant="outline" className={`text-[10px] border gap-1 ${roomCfg.className}`}>
                          {ROOM_ICON[roomMode]}
                          {roomCfg.label}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      {contract.starts_at
                        ? new Date(contract.starts_at).toLocaleDateString('pt-BR')
                        : '—'}
                      {' → '}
                      {contract.ends_at
                        ? new Date(contract.ends_at).toLocaleDateString('pt-BR')
                        : 'Indeterminado'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {hasSLA ? (
                        <div className="flex items-center gap-1 text-xs text-purple-400">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {slaCount} prioridade{slaCount !== 1 ? 's' : ''}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não aplicável</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContract(contract.id);
                        }}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>

                  {/* D — Painel SLA inline — só para contratos com sustentação */}
                  {isExpanded && hasSLA && (
                    <tr key={`sla-${contract.id}`}>
                      <td colSpan={6} className="px-4 py-4 bg-muted/10 border-t">
                        <SLACompliancePanel contractId={contract.id} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ContractForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); reload(); }}
        />
      )}

      {selectedContract && (
        <ContractDetail
          contractId={selectedContract}
          onClose={() => setSelectedContract(null)}
          onUpdate={reload}
        />
      )}
    </div>
  );
}

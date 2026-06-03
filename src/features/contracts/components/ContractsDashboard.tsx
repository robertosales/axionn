import { useState } from 'react';
import { FileText, Plus, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContracts } from '../hooks/useContracts';
import { CONTRACT_STATUS_CONFIG } from '../types/contract';
import type { Contract, ContractStatus } from '../types/contract';
import { ContractForm } from './ContractForm';
import { ContractDetail } from './ContractDetail';

export function ContractsDashboard() {
  const { contracts, loading, reload } = useContracts();
  const [showForm, setShowForm]         = useState(false);
  const [selectedId, setSelectedId]     = useState<string | null>(null);

  const active     = contracts.filter((c) => c.status === 'active').length;
  const paused     = contracts.filter((c) => c.status === 'paused').length;
  const terminated = contracts.filter((c) => c.status === 'terminated').length;

  const metrics = [
    {
      label: 'Contratos Ativos',
      value: active,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Pausados',
      value: paused,
      icon: <Clock className="h-4 w-4 text-amber-400" />,
      accent: 'border-l-amber-500',
    },
    {
      label: 'Alertas Críticos SLA',
      value: 0,
      icon: <AlertTriangle className="h-4 w-4 text-rose-400" />,
      accent: 'border-l-rose-500',
    },
    {
      label: 'Total de Contratos',
      value: contracts.length,
      icon: <FileText className="h-4 w-4 text-indigo-400" />,
      accent: 'border-l-indigo-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          <h1 className="text-lg font-bold text-white">Gestão de Contratos</h1>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300">
            {contracts.length}
          </span>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" /> Novo Contrato
        </Button>
      </div>

      {/* Métricas macro */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`bg-slate-900 border border-slate-800 rounded-xl p-5 border-l-4 ${m.accent}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {m.icon}
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                {m.label}
              </p>
            </div>
            <p className="text-3xl font-bold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela de contratos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Contratos</h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full">
            Atualizado em tempo real
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Carregando...</div>
        ) : contracts.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum contrato cadastrado.</p>
            <Button
              size="sm"
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white"
              onClick={() => setShowForm(true)}
            >
              Criar primeiro contrato
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                {['Contrato', 'Status', 'Vigência', 'SLAs configurados', 'Ações'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] uppercase tracking-wider font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contracts.map((c: Contract) => {
                const statusCfg = CONTRACT_STATUS_CONFIG[c.status as ContractStatus];
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-white">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-slate-500 truncate max-w-[220px]">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={`text-xs border ${statusCfg.className}`}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {c.starts_at
                        ? new Date(c.starts_at).toLocaleDateString('pt-BR')
                        : '—'}
                      {' → '}
                      {c.ends_at
                        ? new Date(c.ends_at).toLocaleDateString('pt-BR')
                        : 'Indeterminado'}
                    </td>
                    <td className="px-5 py-3">
                      {c.contract_slas && c.contract_slas.length > 0 ? (
                        <span className="text-xs text-indigo-400">
                          {c.contract_slas.length} prioridade
                          {c.contract_slas.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400">Sem SLA</span>
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-indigo-400 hover:text-indigo-300 text-xs h-7"
                        onClick={() => setSelectedId(c.id)}
                      >
                        Configurar →
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: novo contrato */}
      {showForm && (
        <ContractForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {/* Painel lateral: detalhe do contrato */}
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

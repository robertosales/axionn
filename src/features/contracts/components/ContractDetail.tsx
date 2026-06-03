import { useState } from 'react';
import { X, Edit2, Trash2, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useContractDetail } from '../hooks/useContracts';
import { deleteContract, fetchTeamsByContract } from '../services/contracts.service';
import { CONTRACT_STATUS_CONFIG, PRIORITY_CONFIG } from '../types/contract';
import type { ContractStatus, SLAPriority } from '../types/contract';
import { ContractForm } from './ContractForm';
import { useEffect } from 'react';

interface Props {
  contractId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function ContractDetail({ contractId, onClose, onUpdate }: Props) {
  const { contract, loading } = useContractDetail(contractId);
  const [editing, setEditing] = useState(false);
  const [teams, setTeams]     = useState<{ id: string; name: string; team_type: string | null }[]>([]);

  useEffect(() => {
    fetchTeamsByContract(contractId).then(setTeams).catch(() => {});
  }, [contractId]);

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este contrato? Todos os SLAs serão removidos.')) return;
    try {
      await deleteContract(contractId);
      toast.success('Contrato excluído.');
      onUpdate();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir');
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
        <div className="text-slate-300">Carregando...</div>
      </div>
    );
  }

  if (!contract) return null;

  const statusCfg = CONTRACT_STATUS_CONFIG[contract.status as ContractStatus];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
        {/* Header do painel */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">{contract.name}</h2>
            <Badge className={`mt-1 text-xs border ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-indigo-400 hover:text-indigo-300 h-8"
              onClick={() => setEditing(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-400 hover:text-rose-300 h-8"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400 h-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Informações gerais */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800">
            <div className="px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">Descrição</p>
              <p className="text-sm text-slate-300">{contract.description || '—'}</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">Início</p>
                <p className="text-sm text-slate-300">
                  {contract.starts_at
                    ? new Date(contract.starts_at).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">Fim</p>
                <p className="text-sm text-slate-300">
                  {contract.ends_at
                    ? new Date(contract.ends_at).toLocaleDateString('pt-BR')
                    : 'Indeterminado'}
                </p>
              </div>
            </div>
          </div>

          {/* Times vinculados */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Link className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Times Vinculados
              </h3>
            </div>
            {teams.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum time vinculado.</p>
            ) : (
              <div className="space-y-2">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-4 py-2.5 bg-slate-950 rounded-lg border border-slate-800"
                  >
                    <span className="text-sm text-white">{t.name}</span>
                    <Badge className={
                      t.team_type === 'agile'
                        ? 'bg-blue-950 text-blue-400 border-blue-900 text-xs'
                        : 'bg-purple-950 text-purple-400 border-purple-900 text-xs'
                    }>
                      {t.team_type === 'agile' ? '⚡ Ágil' : '🛠 Sustentação'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Matriz de SLA */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Matriz de SLA
            </h3>
            {!contract.contract_slas || contract.contract_slas.length === 0 ? (
              <p className="text-xs text-amber-400">Nenhum SLA configurado.</p>
            ) : (
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-950 text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Prioridade</th>
                      <th className="px-4 py-2.5 text-left font-semibold">1ª Resposta</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Resolução</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Regime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {contract.contract_slas.map((sla) => {
                      const cfg = PRIORITY_CONFIG[sla.priority as SLAPriority];
                      return (
                        <tr key={sla.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${cfg.bgColor}`} />
                              <span className="text-white">{cfg.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">
                            {sla.response_time_minutes} min
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">
                            {(sla.resolution_time_minutes / 60).toFixed(0)}h
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={
                              sla.business_hours_only
                                ? 'text-sky-400'
                                : 'text-violet-400'
                            }>
                              {sla.business_hours_only ? '8×5' : '24×7'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de edição */}
      {editing && (
        <ContractForm
          initialData={{ ...contract }}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
}

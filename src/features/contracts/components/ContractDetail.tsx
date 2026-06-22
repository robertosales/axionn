import { useState } from 'react';
import { X, Edit2, Trash2, FileText, ShieldCheck, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useContractDetail } from '../hooks/useContracts';
import { deleteContract } from '../services/contracts.service';
import { CONTRACT_STATUS_CONFIG, PRIORITY_CONFIG, ROOM_MODE_CONFIG } from '../types/contract';
import type { ContractStatus, SLAPriority } from '../types/contract';
import { ContractForm } from './ContractForm';
import { ProjectTeamsPanel } from './ProjectTeamsPanel';

interface Props {
  contractId: string;
  onClose: () => void;
  onUpdate: () => void;
}

/** Normaliza ISO timestamp ou YYYY-MM-DD para YYYY-MM-DD (o que o <input type="date"> precisa) */
function toDateInput(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function ContractDetail({ contractId, onClose, onUpdate }: Props) {
  const { contract, loading } = useContractDetail(contractId);
  const [editing, setEditing] = useState(false);

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
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!contract) return null;

  const statusCfg  = CONTRACT_STATUS_CONFIG[contract.status as ContractStatus];
  const roomMode   = (contract as any).room_mode ?? 'sustentacao';
  const roomCfg    = ROOM_MODE_CONFIG[roomMode as keyof typeof ROOM_MODE_CONFIG];
  const hasSLA     = roomCfg?.hasSLA ?? true;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-bold">{contract.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-xs border ${statusCfg.className}`}>
                {statusCfg.label}
              </Badge>
              {roomCfg && (
                <Badge variant="outline" className={`text-xs border ${roomCfg.className}`}>
                  {roomCfg.icon} {roomCfg.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive h-8"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Dados gerais */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dados do Contrato
              </h3>
            </div>
            <div className="rounded-lg border bg-card divide-y">
              <div className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">Descrição</p>
                <p className="text-sm">{contract.description || '—'}</p>
              </div>
              <div className="px-4 py-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">Início</p>
                  <p className="text-sm">
                    {contract.starts_at
                      ? new Date(contract.starts_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">Fim</p>
                  <p className="text-sm">
                    {contract.ends_at
                      ? new Date(contract.ends_at).toLocaleDateString('pt-BR')
                      : 'Indeterminado'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Projetos e Times */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Projetos &amp; Times
              </h3>
            </div>
            {/* Passa room_mode para o painel respeitar RN02/RN04 */}
            <ProjectTeamsPanel contractId={contractId} roomMode={roomMode} />
          </section>

          {/* Matriz de SLA — só se hasSLA (RN03) */}
          {hasSLA && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Matriz de SLA
                </h3>
              </div>
              {!contract.contract_slas || contract.contract_slas.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum SLA configurado.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr className="text-muted-foreground uppercase">
                        <th className="px-4 py-2.5 text-left font-semibold">Prioridade</th>
                        <th className="px-4 py-2.5 text-left font-semibold">1ª Resposta</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Resolução</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Regime</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {contract.contract_slas.map((sla: any) => {
                        const cfg = PRIORITY_CONFIG[sla.priority as SLAPriority];
                        return (
                          <tr key={sla.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${cfg?.bgColor ?? 'bg-muted'}`} />
                                <span className="font-medium">{cfg?.label ?? sla.priority}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {sla.response_time_minutes} min
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {(sla.resolution_time_minutes / 60).toFixed(0)}h
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={sla.business_hours_only ? 'text-sky-500' : 'text-violet-500'}>
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
            </section>
          )}

        </div>
      </div>

      {editing && (
        <ContractForm
          initialData={{
            ...contract,
            room_mode:  roomMode,
            // Normaliza datas para YYYY-MM-DD antes de passar ao formulário
            starts_at:  toDateInput(contract.starts_at),
            ends_at:    toDateInput(contract.ends_at),
          }}
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

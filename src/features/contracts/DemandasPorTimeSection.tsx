// DemandasPorTimeSection — fila de demandas de um time com badge SLA dinâmico
// Plugado no ContractDetail > ProjectTeamsPanel > lista de demandas por time
import { useDemandasWithResponsaveis } from '@/hooks/useDemandasWithResponsaveis';
import { SLABadge } from '@/features/sustentacao/components/SLABadge';
import { Badge }    from '@/components/ui/badge';
import { Loader2 }  from 'lucide-react';

type Props = {
  teamId: string;
  contractId?: string;   // passado pelo painel de contratos para calcular SLA contratual
};

const SITUACAO_CONFIG: Record<string, { label: string; className: string }> = {
  aberta:      { label: 'Aberta',      className: 'bg-blue-950   text-blue-300   border-blue-800'   },
  em_andamento:{ label: 'Em andamento',className: 'bg-yellow-950 text-yellow-300 border-yellow-800' },
  bloqueada:   { label: 'Bloqueada',   className: 'bg-red-950    text-red-300    border-red-800'    },
  concluida:   { label: 'Concluída',   className: 'bg-green-950  text-green-300  border-green-800'  },
  cancelada:   { label: 'Cancelada',   className: 'bg-muted      text-muted-foreground border-border'},
};

export function DemandasPorTimeSection({ teamId, contractId }: Props) {
  const { data: demandas, loading, error } = useDemandasWithResponsaveis(teamId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando demandas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive text-sm">
        Erro ao carregar demandas.
      </div>
    );
  }

  if (demandas.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm text-center">
        Nenhuma demanda encontrada para este time.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground uppercase">
            <th className="text-left py-2 px-3 font-semibold">RHM</th>
            <th className="text-left py-2 px-3 font-semibold">Descrição</th>
            <th className="text-left py-2 px-3 font-semibold">Projeto</th>
            <th className="text-left py-2 px-3 font-semibold">Situação</th>
            <th className="text-left py-2 px-3 font-semibold">SLA</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {demandas.map((d) => {
            const situacaoCfg = SITUACAO_CONFIG[d.situacao ?? ''] ?? null;
            const resolvedContractId = contractId ?? (d as any).contract_id ?? null;

            return (
              <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2 px-3 font-mono text-xs text-info">{d.rhm ?? '—'}</td>
                <td className="py-2 px-3 max-w-[200px]">
                  <p className="truncate text-xs">{(d as any).descricao ?? '—'}</p>
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {d.project_name ?? 'Sem projeto'}
                </td>
                <td className="py-2 px-3">
                  {situacaoCfg ? (
                    <Badge variant="outline" className={`text-[10px] border ${situacaoCfg.className}`}>
                      {situacaoCfg.label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{d.situacao ?? '—'}</span>
                  )}
                </td>
                <td className="py-2 px-3">
                  {/* Badge SLA dinâmico — usa contrato do time ou do painel */}
                  <SLABadge
                    demandaId={d.id}
                    contractId={resolvedContractId}
                    priority={(d as any).sla_priority ?? null}
                    createdAt={(d as any).created_at ?? (d as any).data_abertura ?? ''}
                    slaLegado={(d as any).sla ?? null}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

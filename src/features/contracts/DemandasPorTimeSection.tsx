import { useDemandasWithResponsaveis } from "@/hooks/useDemandasWithResponsaveis";

type Props = {
  teamId: string;
};

export function DemandasPorTimeSection({ teamId }: Props) {
  const { data: demandas, loading, error } = useDemandasWithResponsaveis(teamId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Carregando demandas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        Erro ao carregar demandas.
      </div>
    );
  }

  if (demandas.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Nenhuma demanda encontrada para este time.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-4 font-medium">RHM</th>
            <th className="text-left py-2 px-4 font-medium">Projeto</th>
            <th className="text-left py-2 px-4 font-medium">Contrato</th>
          </tr>
        </thead>
        <tbody>
          {demandas.map((d) => (
            <tr key={d.id} className="border-b hover:bg-muted/50 transition-colors">
              <td className="py-2 px-4">{d.rhm ?? "—"}</td>
              <td className="py-2 px-4">{d.project_name ?? "Sem projeto"}</td>
              <td className="py-2 px-4">{d.contract_name ?? "Sem contrato"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

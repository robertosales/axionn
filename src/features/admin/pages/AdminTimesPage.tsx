import { TeamManager } from "@/components/TeamManager";

/**
 * Aba "Times" do Dashboard Admin.
 * Reutiliza o componente TeamManager já existente em vez de duplicar
 * a lógica de listagem, CRUD e visualização de membros.
 */
export function AdminTimesPage() {
  return <TeamManager />;
}

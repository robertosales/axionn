// src/hooks/usePermissions.ts
import { supabase } from "@/integrations/supabase/client";

export type AppRole = string;
export type Permission = string;

// ✅ Busca permissões do banco — async
export async function getPermissionsForRoles(roles: AppRole[]): Promise<Set<Permission>> {
  if (!roles.length) return new Set();
  const { data } = await supabase.from("role_permissions").select("permission_key").in("role_name", roles);
  return new Set((data || []).map((r: any) => r.permission_key));
}

// ✅ Busca roles disponíveis do banco — async
export async function fetchAllRoles(): Promise<{ name: string; label: string }[]> {
  const { data } = await supabase.from("app_roles").select("name, label").order("sort_order");
  return (data || []) as { name: string; label: string }[];
}

// Mantido para compatibilidade com componentes que ainda usam síncronamente
export const ALL_ROLES: AppRole[] = [
  "admin",
  "admin_contrato",
  "scrum_master",
  "product_owner",
  "developer",
  "analyst",
  "architect",
  "qa_analyst",
  "member",
];

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin:          "Administrador",
    admin_contrato: "Admin do Contrato",
    scrum_master:   "Scrum Master",
    product_owner:  "Product Owner",
    developer:      "Desenvolvedor",
    analyst:        "Analista de Requisitos",
    architect:      "Arquiteto",
    qa_analyst:     "Analista de QA",
    member:         "Membro",
  };
  return labels[role] || role;
}

// src/components/DashboardHome.tsx
// Dashboard da Sala Ágil — renderiza sempre AgilView diretamente.
// As abas (Visão Global / Sala Ágil / Sustentação) pertencem exclusivamente
// ao AdminDashboard (Visão Geral) e não devem aparecer aqui.

import { AgilView } from "@/components/dashboard/AgilView";

export function DashboardHome() {
  return <AgilView />;
}

// src/components/dashboard/AgilView.tsx
// Cenário B — visão exclusiva da Sala Ágil.
// Reutiliza o DashboardHome existente sem alterações; este wrapper
// existe para que o orquestrador DashboardHome possa importá-lo por tab.

import { DashboardHome as _DashboardHome } from "@/components/DashboardHome";

/**
 * Wrapper de identidade — mantém o DashboardHome original intacto
 * e o expõe sob o contrato de "aba Ágil" do novo orquestrador.
 */
export function AgilView() {
  return <_DashboardHome />;
}

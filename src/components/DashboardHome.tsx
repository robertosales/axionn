// src/components/DashboardHome.tsx
// Orquestrador RBAC da Visão Geral.
//
// Lógica de decisão por perfil:
//   isAdminContrato  → exibe as 3 abas, inicia em "global"
//   hasSalaAgil      → sem abas, renderiza direto AgilView
//   hasSustentacao   → sem abas, renderiza direto SustentacaoView
//   (fallback)       → AgilView (comportamento legado preservado)
//
// IMPORTANTE: o conteúdo visual original do dashboard está preservado
// em AgilView — nenhum pixel foi alterado na visão de Sala Ágil.

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardTabs, type DashboardTab } from "@/components/dashboard/DashboardTabs";
import { AgilView }        from "@/components/dashboard/AgilView";
import { SustentacaoView } from "@/components/dashboard/SustentacaoView";
import { GlobalView }      from "@/components/dashboard/GlobalView";

// ── Deriva flags RBAC a partir de moduleRoles ────────────────────────────────
// moduleRoles = [{ module: "sala_agil" | "sustentacao" | "rdm", role_name: "admin"|"member" }]
// isAdminContrato → tem role_name "admin" em QUALQUER módulo, ou isAdmin global.
function useDashboardAccess() {
  const { moduleRoles, isAdmin } = useAuth();

  return useMemo(() => {
    const modules = moduleRoles.map((r) => r.module);
    const adminModules = moduleRoles
      .filter((r) => r.role_name === "admin")
      .map((r) => r.module);

    // Admin de contrato = admin global OU tem role admin em qualquer módulo
    const isAdminContrato = isAdmin || adminModules.length > 0;

    const hasSalaAgil    = modules.includes("sala_agil");
    const hasSustentacao = modules.includes("sustentacao");

    return { isAdminContrato, hasSalaAgil, hasSustentacao };
  }, [moduleRoles, isAdmin]);
}

// ── Componente principal ──────────────────────────────────────────────────────
export function DashboardHome() {
  const { isAdminContrato, hasSalaAgil, hasSustentacao } = useDashboardAccess();

  // Aba inicial por perfil
  const initialTab: DashboardTab = useMemo(() => {
    if (isAdminContrato)  return "global";
    if (hasSustentacao && !hasSalaAgil) return "sustentacao";
    return "agil";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminContrato, hasSalaAgil, hasSustentacao]);

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* Barra de abas — só para admins de contrato */}
      {isAdminContrato && (
        <div className="px-4 sm:px-6 pt-4">
          <DashboardTabs active={activeTab} onChange={setActiveTab} />
        </div>
      )}

      {/* Painel da aba ativa */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-label={
          activeTab === "global"
            ? "Visão Global"
            : activeTab === "agil"
            ? "Sala Ágil"
            : "Sustentação"
        }
      >
        {/* Cenário A — admin contrato, aba global */}
        {activeTab === "global" && <GlobalView />}

        {/* Cenário B — sala ágil (aba selecionada ou perfil focado) */}
        {activeTab === "agil" && <AgilView />}

        {/* Cenário C — sustentação (aba selecionada ou perfil focado) */}
        {activeTab === "sustentacao" && <SustentacaoView />}
      </div>
    </div>
  );
}

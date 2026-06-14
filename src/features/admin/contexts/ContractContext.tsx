import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useContracts, type Contract } from "@/features/admin/hooks/useContracts";
import { supabase } from "@/integrations/supabase/client";

interface ContractContextValue {
  /** null = "todos os contratos" (só para gestor) */
  selectedContractId: string | null;
  selectedContract:   Contract | null;
  setSelectedContractId: (id: string | null) => void;
  contracts: Contract[];
  /** true = usuário é gestor master (sem user_contracts, role admin) */
  isGestor: boolean;
  loading: boolean;
}

const ContractContext = createContext<ContractContextValue | null>(null);

export function ContractProvider({ children }: { children: ReactNode }) {
  const { contracts, loading: contractsLoading } = useContracts();
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [isGestor,  setIsGestor]  = useState(false);
  const [resolved,  setResolved]  = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setResolved(true); return; }

      // Busca em paralelo: vínculo em user_contracts + role admin
      const [{ data: uc }, { data: role }] = await Promise.all([
        supabase
          .from("user_contracts")
          .select("contract_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);

      const isAdmin = !!role;

      if (isAdmin) {
        // Admin/Gestor: pode trocar entre todos os contratos.
        // Se houver vínculo em user_contracts, usa como pré-seleção;
        // caso contrário, o effect abaixo seleciona o primeiro automaticamente.
        setIsGestor(true);
        setSelectedContractId(uc?.contract_id ?? null);
      } else if (uc?.contract_id) {
        // Usuário comum vinculado a um contrato: fixo (locked).
        setIsGestor(false);
        setSelectedContractId(uc.contract_id);
      } else {
        // Usuário comum sem vínculo: sem contrato.
        setIsGestor(false);
        setSelectedContractId(null);
      }
      setResolved(true);
    });
  }, []);

  // Quando os contratos carregarem e o gestor ainda não tiver selecionado nenhum,
  // pré-seleciona o primeiro automaticamente para uma UX melhor
  useEffect(() => {
    if (isGestor && selectedContractId === null && contracts.length > 0) {
      setSelectedContractId(contracts[0].id);
    }
  }, [isGestor, contracts, selectedContractId]);

  const selectedContract = contracts.find(c => c.id === selectedContractId) ?? null;

  return (
    <ContractContext.Provider value={{
      selectedContractId,
      selectedContract,
      setSelectedContractId,
      contracts,
      isGestor,
      loading: !resolved || contractsLoading,
    }}>
      {children}
    </ContractContext.Provider>
  );
}

export function useContractContext() {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error("useContractContext deve ser usado dentro de <ContractProvider>");
  return ctx;
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  useContracts,
  type Contract,
} from "@/features/admin/hooks/useContracts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ContractContextValue {
  selectedContractId: string | null;
  selectedContract: Contract | null;
  setSelectedContractId: (id: string | null) => void;
  contracts: Contract[];
  isGestor: boolean;
  loading: boolean;
}

const ContractContext = createContext<ContractContextValue | null>(null);

export function ContractProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const { contracts, loading: contractsLoading } = useContracts();
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null,
  );
  const [isGestor, setIsGestor] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!user) {
      setSelectedContractId(null);
      setIsGestor(false);
      setResolved(true);
      return;
    }

    let cancelled = false;
    setResolved(false);

    void supabase
      .from("user_contracts")
      .select("contract_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[ContractContext] user_contracts:", error);
        }

        setIsGestor(isAdmin);
        setSelectedContractId(data?.contract_id ?? null);
        setResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, user]);

  useEffect(() => {
    if (contractsLoading || !resolved) return;

    if (contracts.length === 0) {
      setSelectedContractId(null);
      return;
    }

    const selectionIsAccessible = Boolean(
      selectedContractId &&
        contracts.some((contract) => contract.id === selectedContractId),
    );

    if (selectionIsAccessible) return;

    setSelectedContractId(isGestor ? contracts[0].id : null);
  }, [contracts, contractsLoading, isGestor, resolved, selectedContractId]);

  const selectedContract =
    contracts.find((contract) => contract.id === selectedContractId) ?? null;

  return (
    <ContractContext.Provider
      value={{
        selectedContractId,
        selectedContract,
        setSelectedContractId,
        contracts,
        isGestor,
        loading: !resolved || contractsLoading,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export function useContractContext() {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContractContext deve ser usado dentro de <ContractProvider>");
  }
  return context;
}

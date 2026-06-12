/**
 * useContractName — mantido por compatibilidade.
 * Internamente lê do ContractContext para ser consistente
 * com o seletor do gestor.
 *
 * Se o ContractContext não estiver disponível (uso fora do AdminDashboard),
 * faz fallback para a query direta no Supabase.
 */
import { useContractContext } from "../contexts/ContractContext";

export function useContractName(): string | null {
  try {
    const ctx = useContractContext();
    return ctx?.selectedContract?.name ?? null;
  } catch {
    // Provider ausente — não deve acontecer dentro do admin, mas evita crash.
    return null;
  }
}

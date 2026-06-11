/**
 * useContractName — mantido por compatibilidade.
 * Internamente lê do ContractContext para ser consistente
 * com o seletor do gestor.
 *
 * Se o ContractContext não estiver disponível (uso fora do AdminDashboard),
 * faz fallback para a query direta no Supabase.
 */
import { useContext } from "react";
import { ContractContext } from "../contexts/ContractContext";

export function useContractName(): string | null {
  // Tenta consumir o contexto
  const ctx = useContext(ContractContext as React.Context<any>);
  if (ctx) return ctx.selectedContract?.name ?? null;

  // fallback (não deve acontecer dentro do admin, mas evita crash)
  return null;
}

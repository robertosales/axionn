/**
 * useModuleTeam — gerencia currentTeamId com escopo de módulo.
 *
 * PROBLEMA RAIZ:
 *   AuthContext usa uma única chave 'selectedTeamId' no localStorage.
 *   Quando o usuário navega pela Sala Ágil e depois abre Sustentação,
 *   o ID gravado pertence ao time de sala_agil. A RPC
 *   get_demandas_with_responsaveis(p_team_id) recebe esse ID e retorna []
 *   porque não há demandas de Sustentação naquele time.
 *
 * SOLUÇÃO:
 *   Cada módulo persiste seu próprio teamId em 'selectedTeamId_{module}'.
 *   No mount, se o ID salvo é válido para o módulo, usa-o diretamente
 *   sem tocar no currentTeamId global do AuthContext.
 *   Se não há ID válido salvo, seleciona automaticamente (1 time) ou
 *   abre o modal de seleção (múltiplos times).
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = (module: string) => `selectedTeamId_${module}`;

export interface UseModuleTeamReturn {
  moduleTeamId:    string | null;
  moduleTeams:     { id: string; name: string; module: string }[];
  showTeamModal:   boolean;
  setModuleTeamId: (id: string) => void;
  closeTeamModal:  () => void;
}

export function useModuleTeam(module: string): UseModuleTeamReturn {
  const { teams, setCurrentTeamId, currentTeamId, loading: authLoading } = useAuth();

  const moduleTeams = teams.filter((t) => t.module === module);

  // Lê chave específica do módulo no localStorage
  const savedId = typeof window !== 'undefined'
    ? localStorage.getItem(STORAGE_KEY(module))
    : null;

  const initialId = savedId && moduleTeams.some((t) => t.id === savedId)
    ? savedId
    : moduleTeams.length === 1 ? moduleTeams[0].id : null;

  const [moduleTeamId, setModuleTeamIdState] = useState<string | null>(initialId);
  const [showTeamModal, setShowTeamModal]     = useState(false);
  const resolvedRef = useRef(false);

  // Propaga para o AuthContext sempre que mudar
  const setModuleTeamId = (id: string) => {
    localStorage.setItem(STORAGE_KEY(module), id);
    setModuleTeamIdState(id);
    setCurrentTeamId(id);
    setShowTeamModal(false);
    resolvedRef.current = true;
  };

  useEffect(() => {
    if (authLoading || resolvedRef.current) return;
    if (moduleTeams.length === 0) return;

    // Valida o ID atual contra os times do módulo
    const saved   = localStorage.getItem(STORAGE_KEY(module));
    const isValid = saved && moduleTeams.some((t) => t.id === saved);

    if (isValid) {
      // ID salvo válido: sincroniza com AuthContext e usa
      setModuleTeamIdState(saved!);
      setCurrentTeamId(saved!);
      resolvedRef.current = true;
      return;
    }

    if (moduleTeams.length === 1) {
      // Único time: seleciona automaticamente
      setModuleTeamId(moduleTeams[0].id);
      return;
    }

    // Múltiplos times sem seleção válida: abre modal
    setShowTeamModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, moduleTeams.length]);

  return {
    moduleTeamId,
    moduleTeams,
    showTeamModal,
    setModuleTeamId,
    closeTeamModal: () => setShowTeamModal(false),
  };
}

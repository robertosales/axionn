// ============================================================
// C — useContractRoomTeams
// Hook para gerenciar vínculos N:N time×sala via contract_room_teams.
// RN04: mesmo time pode estar em Ágil E Sustentação.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import {
  fetchContractRoomTeams,
  linkTeamToContract,
  unlinkTeamFromContract,
} from '../services/contracts.service';

export interface RoomTeamEntry {
  id:         string;
  teamId:     string;
  roomType:   'agil' | 'sustentacao';
  teamName?:  string;
  teamModule?: string;
}

export function useContractRoomTeams(contractId: string | null) {
  const [roomTeams, setRoomTeams] = useState<RoomTeamEntry[]>([]);
  const [loading,   setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!contractId) { setRoomTeams([]); return; }
    setLoading(true);
    try {
      const data = await fetchContractRoomTeams(contractId);
      setRoomTeams(data);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const link = useCallback(async (
    teamId: string,
    roomType: 'agil' | 'sustentacao',
  ) => {
    if (!contractId) return;
    await linkTeamToContract(contractId, teamId, roomType);
    await load();
  }, [contractId, load]);

  const unlink = useCallback(async (
    teamId: string,
    roomType: 'agil' | 'sustentacao',
  ) => {
    if (!contractId) return;
    await unlinkTeamFromContract(contractId, teamId, roomType);
    await load();
  }, [contractId, load]);

  const teamsForRoom = useCallback((roomType: 'agil' | 'sustentacao') =>
    roomTeams.filter(rt => rt.roomType === roomType),
  [roomTeams]);

  return { roomTeams, loading, link, unlink, teamsForRoom, reload: load };
}

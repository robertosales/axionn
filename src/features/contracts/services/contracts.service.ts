import { supabase } from "@/integrations/supabase/client";
import type { ContractFormData, SlaRow } from "../types/contract";

async function writeAuditLog(
  contractId: string,
  action: string,
  payload?: Record<string, unknown>,
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("contract_audit_log").insert({
      contract_id: contractId,
      admin_id: user.id,
      action,
      payload: payload ?? null,
    });
  } catch {
    // O registro de auditoria não deve interromper a operação principal.
  }
}

export async function fetchContracts(organizationId?: string | null) {
  let query = supabase
    .from("contracts")
    .select("*, contract_slas(*)")
    .order("created_at", { ascending: false });

  if (organizationId) query = query.eq("org_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchContractById(
  id: string,
  organizationId?: string | null,
) {
  let query = supabase
    .from("contracts")
    .select("*, contract_slas(*)")
    .eq("id", id);

  if (organizationId) query = query.eq("org_id", organizationId);

  const { data, error } = await query.single();
  if (error) throw error;
  return data;
}

export async function createContract(
  form: ContractFormData,
  organizationId?: string | null,
) {
  const { data, error } = await supabase
    .from("contracts")
    .insert([
      {
        name: form.name,
        description: form.description || null,
        status: form.status,
        room_mode: form.room_mode ?? "sustentacao",
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        ...(organizationId ? { org_id: organizationId } : {}),
      },
    ])
    .select("id")
    .single();
  if (error) throw error;

  const contractId = data.id as string;
  await writeAuditLog(contractId, "created", {
    name: form.name,
    room_mode: form.room_mode,
    status: form.status,
    organizationId: organizationId ?? null,
  });
  return contractId;
}

export async function updateContract(
  id: string,
  form: ContractFormData,
  organizationId?: string | null,
) {
  let query = supabase
    .from("contracts")
    .update({
      name: form.name,
      description: form.description || null,
      status: form.status,
      room_mode: form.room_mode ?? "sustentacao",
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    })
    .eq("id", id);

  if (organizationId) query = query.eq("org_id", organizationId);

  const { error } = await query;
  if (error) throw error;
  await writeAuditLog(id, "updated", {
    name: form.name,
    room_mode: form.room_mode,
    status: form.status,
  });
}

export async function deleteContract(
  id: string,
  organizationId?: string | null,
) {
  await writeAuditLog(id, "deleted", {});
  let query = supabase.from("contracts").delete().eq("id", id);
  if (organizationId) query = query.eq("org_id", organizationId);

  const { error } = await query;
  if (error) throw error;
}

export async function upsertContractSlas(contractId: string, slas: SlaRow[]) {
  const { error: deleteError } = await supabase
    .from("contract_slas")
    .delete()
    .eq("contract_id", contractId);
  if (deleteError) throw deleteError;

  if (slas.length === 0) return;
  const { error } = await supabase.from("contract_slas").insert(
    slas.map((sla) => ({ ...sla, contract_id: contractId })),
  );
  if (error) throw error;

  await writeAuditLog(contractId, "sla_updated", {
    priorities: slas.map((sla) => sla.priority),
  });
}

export async function linkTeamToContract(
  contractId: string,
  teamId: string,
  roomType: "agil" | "sustentacao",
): Promise<void> {
  const { error } = await supabase.from("contract_room_teams").upsert(
    { contract_id: contractId, team_id: teamId, room_type: roomType },
    { onConflict: "contract_id,team_id,room_type" },
  );
  if (error) throw error;
  await writeAuditLog(contractId, "team_linked", { teamId, roomType });
}

export async function unlinkTeamFromContract(
  contractId: string,
  teamId: string,
  roomType: "agil" | "sustentacao",
): Promise<void> {
  const { error } = await supabase
    .from("contract_room_teams")
    .delete()
    .eq("contract_id", contractId)
    .eq("team_id", teamId)
    .eq("room_type", roomType);
  if (error) throw error;
  await writeAuditLog(contractId, "team_unlinked", { teamId, roomType });
}

export async function fetchContractRoomTeams(contractId: string) {
  const { data, error } = await supabase
    .from("contract_room_teams")
    .select("id, team_id, room_type, created_at, teams(id, name, module)")
    .eq("contract_id", contractId)
    .order("room_type");
  if (error) throw error;

  return (data ?? []).map((relation: Record<string, unknown>) => {
    const team = relation.teams as
      | { id?: string; name?: string; module?: string }
      | null
      | undefined;
    return {
      id: relation.id,
      teamId: relation.team_id,
      roomType: relation.room_type,
      teamName: team?.name,
      teamModule: team?.module,
    };
  });
}

export async function fetchActiveContracts(
  organizationId?: string | null,
): Promise<{ id: string; name: string }[]> {
  let query = supabase
    .from("contracts")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  if (organizationId) query = query.eq("org_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchFreeTeams(
  organizationId?: string | null,
): Promise<{ id: string; name: string; module: string }[]> {
  if (organizationId) {
    const { data, error } = await supabase.rpc("get_accessible_teams_v2", {
      p_org_id: organizationId,
    });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((team) => ({
      id: String(team.id),
      name: String(team.name ?? "Time"),
      module: String(team.module ?? ""),
    }));
  }

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, module")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTeamContract(teamId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("fn_get_team_contract", {
    p_team_id: teamId,
  });
  if (error) throw error;
  return data;
}

export async function checkSlaStatus(params: {
  demandaId: string;
  contractId: string;
  priority: string;
  createdAt: string;
}): Promise<unknown> {
  const { data, error } = await supabase.rpc("fn_check_sla_status", {
    p_demanda_id: params.demandaId,
    p_contract_id: params.contractId,
    p_priority: params.priority,
    p_created_at: params.createdAt,
  });
  if (error) throw error;
  return data;
}

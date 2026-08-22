import { expect, test } from "../playwright-fixture";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const organizationId = process.env.E2E_ORGANIZATION_ID;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const hasConfiguration = Boolean(
  email && password && organizationId && supabaseUrl && supabaseKey,
);

interface OrganizationTeam {
  id: string;
  name: string;
  module: string;
  org_id: string;
}

interface TeamMembership {
  email: string;
  role: string;
  team_id: string;
  user_id: string;
}

interface DetailedTeamMembership extends TeamMembership {
  team_member_id: string;
}

test.describe("identidade compartilhada e times isolados por módulo", () => {
  test.skip(
    !hasConfiguration,
    "Defina as credenciais E2E e a configuração pública do Supabase.",
  );

  test("mantém Roberto em Sala Ágil e Sustentação sem cruzar tenants", async ({ request }) => {
    const authResponse = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: supabaseKey!, "Content-Type": "application/json" },
        data: { email, password },
      },
    );
    expect(authResponse.ok(), await authResponse.text()).toBeTruthy();
    const auth = await authResponse.json() as { access_token: string; user: { id: string; email?: string } };
    expect(auth.user.email?.toLowerCase()).toBe(email!.toLowerCase());

    const headers = {
      apikey: supabaseKey!,
      Authorization: `Bearer ${auth.access_token}`,
      "Content-Type": "application/json",
    };
    const teamsResponse = await request.post(
      `${supabaseUrl}/rest/v1/rpc/get_organization_teams_admin_v2`,
      { headers, data: { p_org_id: organizationId } },
    );
    expect(teamsResponse.ok(), await teamsResponse.text()).toBeTruthy();
    const teams = await teamsResponse.json() as OrganizationTeam[];
    expect(teams.length).toBeGreaterThan(0);
    expect(teams.every((team) => team.org_id === organizationId)).toBeTruthy();

    const loadMemberships = async () => {
      const response = await request.post(
        `${supabaseUrl}/rest/v1/rpc/get_team_members_for_teams_v2`,
        { headers, data: { p_org_id: organizationId, p_team_ids: teams.map((team) => team.id) } },
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json() as Promise<TeamMembership[]>;
    };

    let memberships = await loadMemberships();
    const teamById = new Map(teams.map((team) => [team.id, team]));
    let robertoMemberships = memberships.filter(
      (membership) => membership.user_id === auth.user.id,
    );
    let modules = new Set(
      robertoMemberships
        .map((membership) => teamById.get(membership.team_id)?.module)
        .filter(Boolean),
    );

    expect(modules.has("sala_agil"), "Roberto sem participação em Sala Ágil").toBeTruthy();
    if (!modules.has("sustentacao")) {
      const sustentacaoTeam = teams.find((team) => team.module === "sustentacao");
      expect(sustentacaoTeam, "Nenhum time de Sustentação disponível").toBeTruthy();
      const addResponse = await request.post(
        `${supabaseUrl}/rest/v1/rpc/add_organization_team_member_v2`,
        {
          headers,
          data: {
            p_org_id: organizationId,
            p_team_id: sustentacaoTeam!.id,
            p_user_id: auth.user.id,
            p_role: "Analista de Requisitos",
          },
        },
      );
      expect(addResponse.ok(), await addResponse.text()).toBeTruthy();
      memberships = await loadMemberships();
      robertoMemberships = memberships.filter(
        (membership) => membership.user_id === auth.user.id,
      );
      modules = new Set(
        robertoMemberships
          .map((membership) => teamById.get(membership.team_id)?.module)
          .filter(Boolean),
      );
    }
    expect(modules.has("sustentacao"), "Roberto sem participação em Sustentação").toBeTruthy();
    expect(robertoMemberships.every((membership) => Boolean(membership.role))).toBeTruthy();

    const currentTeamIds = new Set(robertoMemberships.map((membership) => membership.team_id));
    const temporaryTeam = teams.find((team) => !currentTeamIds.has(team.id));
    expect(temporaryTeam, "Nenhum time livre para validar o ciclo temporário").toBeTruthy();

    let temporaryMembershipId: string | null = null;
    try {
      const addTemporaryResponse = await request.post(
        `${supabaseUrl}/rest/v1/rpc/add_organization_team_member_v2`,
        {
          headers,
          data: {
            p_org_id: organizationId,
            p_team_id: temporaryTeam!.id,
            p_user_id: auth.user.id,
            p_role: "Validação E2E",
          },
        },
      );
      expect(addTemporaryResponse.ok(), await addTemporaryResponse.text()).toBeTruthy();

      const detailResponse = await request.post(
        `${supabaseUrl}/rest/v1/rpc/get_organization_team_members_v2`,
        { headers, data: { p_org_id: organizationId, p_team_id: temporaryTeam!.id } },
      );
      expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy();
      const temporaryMembership = (await detailResponse.json() as DetailedTeamMembership[])
        .find((membership) => membership.user_id === auth.user.id);
      expect(temporaryMembership).toBeTruthy();
      temporaryMembershipId = temporaryMembership!.team_member_id;

      const updateResponse = await request.post(
        `${supabaseUrl}/rest/v1/rpc/update_organization_team_member_role_v2`,
        {
          headers,
          data: {
            p_org_id: organizationId,
            p_team_member_id: temporaryMembershipId,
            p_role: "Validação E2E atualizada",
          },
        },
      );
      expect(updateResponse.ok(), await updateResponse.text()).toBeTruthy();
    } finally {
      if (temporaryMembershipId) {
        const removeResponse = await request.post(
          `${supabaseUrl}/rest/v1/rpc/remove_organization_team_member_v2`,
          {
            headers,
            data: {
              p_org_id: organizationId,
              p_team_member_id: temporaryMembershipId,
            },
          },
        );
        expect(removeResponse.ok(), await removeResponse.text()).toBeTruthy();
      }
    }

    const membershipsAfterCleanup = await loadMemberships();
    expect(
      membershipsAfterCleanup.some(
        (membership) => membership.user_id === auth.user.id && membership.team_id === temporaryTeam!.id,
      ),
    ).toBeFalsy();

    const foreignOrganizationId = "00000000-0000-4000-8000-000000000001";
    expect(foreignOrganizationId).not.toBe(organizationId);
    const foreignResponse = await request.post(
      `${supabaseUrl}/rest/v1/rpc/get_organization_teams_admin_v2`,
      { headers, data: { p_org_id: foreignOrganizationId } },
    );
    if (foreignResponse.ok()) {
      expect(await foreignResponse.json()).toEqual([]);
    } else {
      expect([400, 401, 403, 404]).toContain(foreignResponse.status());
    }
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UsersTable } from "./UsersTable";

describe("UsersTable", () => {
  it("nomeia os controles de administração, status e ações por usuário", () => {
    render(
      <UsersTable
        users={[{
          id: "user-1",
          user_id: "user-1",
          display_name: "Ana Silva",
          email: "ana@example.com",
          module_access: "sala_agil",
          team_id: null,
          teams: [],
          module_roles: [],
          contract_role: null,
          is_admin: false,
          is_active: true,
          must_change_password: false,
          created_at: "2026-01-01T00:00:00Z",
        }]}
        onEdit={vi.fn()}
        onToggleAdmin={vi.fn().mockResolvedValue(true)}
        onToggleActive={vi.fn().mockResolvedValue(true)}
        onResetPassword={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByRole("switch", { name: "Alternar administrador para Ana Silva" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Alternar status ativo para Ana Silva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ações de Ana Silva" })).toBeInTheDocument();
  });
});
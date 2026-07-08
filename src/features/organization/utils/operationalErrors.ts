interface OperationalErrorLike {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

export function resolveOrganizationOperationalError(
  error: unknown,
  fallback: string,
) {
  const candidate = error as OperationalErrorLike | null;
  const message = [
    error instanceof Error ? error.message : null,
    typeof error === "string" ? error : null,
    candidate?.message,
    candidate?.details,
    candidate?.hint,
    candidate?.code,
  ]
    .filter(Boolean)
    .join(" ");

  if (message.includes("contracts.max")) {
    return "O limite de contratos do plano foi atingido.";
  }

  if (message.includes("projects.max")) {
    return "O limite de projetos ativos do plano foi atingido.";
  }

  if (message.includes("users.max")) {
    return "O limite de usuários ativos do plano foi atingido.";
  }

  if (message.includes("organization_resource_limit_reached")) {
    return "O limite de recursos do plano foi atingido.";
  }

  if (
    message.includes("organization_access_denied") ||
    message.includes("organization_operational_admin_required") ||
    message.includes("organization_settings_update_denied")
  ) {
    return "Você não tem permissão para administrar esta organização.";
  }

  if (
    message.includes("organization_context_required") ||
    message.includes("organization_required")
  ) {
    return "Selecione uma organização para continuar.";
  }

  if (
    message.includes("resource_cross_tenant") ||
    message.includes("organization_mismatch") ||
    message.includes("organization_not_operational")
  ) {
    return "O recurso selecionado não pertence à organização ativa.";
  }

  if (message.includes("platform_admin_required")) {
    return "Esta operação é exclusiva da administração da plataforma.";
  }

  if (message.includes("organization_member_inactive")) {
    return "Usuário não é membro ativo da organização.";
  }

  if (message.includes("team_member_user_required")) {
    return "Selecione um usuário para adicionar ao time.";
  }

  if (message.includes("team_member_role_required")) {
    return "Informe a função do membro no time.";
  }

  if (message.includes("team_name_required")) {
    return "Informe o nome do time.";
  }

  if (message.includes("team_module_invalid")) {
    return "Tipo de time inválido.";
  }

  return fallback;
}

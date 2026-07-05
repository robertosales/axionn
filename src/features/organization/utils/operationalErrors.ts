export function resolveOrganizationOperationalError(
  error: unknown,
  fallback: string,
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (message.includes("contracts.max")) {
    return "O limite de contratos do plano foi atingido.";
  }

  if (message.includes("projects.max")) {
    return "O limite de projetos ativos do plano foi atingido.";
  }

  if (message.includes("organization_resource_limit_reached")) {
    return "O limite do plano foi atingido.";
  }

  if (message.includes("organization_access_denied")) {
    return "Voce nao tem permissao para administrar esta organizacao.";
  }

  if (message.includes("organization_context_required")) {
    return "Selecione uma organizacao para continuar.";
  }

  if (
    message.includes("resource_cross_tenant") ||
    message.includes("organization_mismatch") ||
    message.includes("organization_not_operational")
  ) {
    return "O recurso selecionado nao pertence a organizacao ativa.";
  }

  return fallback;
}

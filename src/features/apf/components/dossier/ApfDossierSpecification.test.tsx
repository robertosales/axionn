import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApfDossierSpecification } from "./ApfDossierSpecification";

const deleteDraft = vi.fn();
const hasPermission = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ hasPermission }) }));
vi.mock("../../hooks/useApfEvidenceDossiers", () => ({
  useApfAcceptanceCriteria: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../../services/apfEvidenceDossier.service", () => ({
  deleteApfDraftDossier: (...args: unknown[]) => deleteDraft(...args),
  saveApfAcceptanceCriterion: vi.fn(),
  updateApfDraftDossier: vi.fn(),
}));
vi.mock("./ApfDossierEvidence", () => ({ ApfDossierEvidence: () => null }));
vi.mock("./ApfDossierCounting", () => ({ ApfDossierCounting: () => null }));
vi.mock("./ApfDossierAudit", () => ({ ApfDossierAudit: () => null }));
vi.mock("./ApfDossierValidation", () => ({ ApfDossierValidation: () => null }));
vi.mock("./ApfDossierTraceability", () => ({ ApfDossierTraceability: () => null }));
vi.mock("./ApfLogicalFileMatrix", () => ({ ApfLogicalFileMatrix: () => null }));
vi.mock("./ApfExceptionReviews", () => ({ ApfExceptionReviews: () => null }));
vi.mock("./ApfSpecificationImportDialog", () => ({ ApfSpecificationImportDialog: () => null }));

const dossier = {
  id: "d1", organizationId: "o1", contractId: "c1", projectId: "p1",
  dossierCode: "APF-HU-063", title: "Evidência de contagem", countingType: "impact" as const,
  status: "draft" as const, totalImpactedPf: 0, totalHomologatedPf: null,
  countingSessionId: null, userStoryId: "hu1", updatedAt: "2026-08-18T12:00:00Z",
  userStory: { code: "FUNC-001", title: "Remover item opcional" },
};

function renderScreen(onDeleted = vi.fn().mockResolvedValue(undefined)) {
  render(<ApfDossierSpecification dossier={dossier} onBack={vi.fn()} onDossierChanged={vi.fn().mockResolvedValue(undefined)} onDeleted={onDeleted} onSuccessorCreated={vi.fn().mockResolvedValue(undefined)} />);
  return { onDeleted };
}

async function openDeleteConfirmation() {
  const trigger = screen.getByRole("button", { name: "Abrir ações do dossiê" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
  fireEvent.click(await screen.findByText("Excluir dossiê"));
}

describe("detalhes do dossiê APF", () => {
  beforeEach(() => { vi.clearAllMocks(); hasPermission.mockReturnValue(true); deleteDraft.mockResolvedValue(undefined); });

  it("traduz tipo e status e exibe ações para rascunho autorizado", async () => {
    renderScreen();
    expect(screen.getAllByText("Rascunho")).toHaveLength(2);
    expect(screen.getByText("Impacto")).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Abrir ações do dossiê" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
    expect(await screen.findByText("Editar dossiê")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
  });

  it("oculta as ações sem permissão de revisão", () => {
    hasPermission.mockReturnValue(false);
    renderScreen();
    expect(screen.queryByRole("button", { name: "Abrir ações do dossiê" })).not.toBeInTheDocument();
  });

  it("confirma e conclui a exclusão permanente", async () => {
    const { onDeleted } = renderScreen();
    await openDeleteConfirmation();
    expect(screen.getByText("Esta ação é permanente.", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir permanentemente" }));
    await waitFor(() => expect(deleteDraft).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("preserva a tela quando a exclusão falha", async () => {
    deleteDraft.mockRejectedValue(new Error("Falha simulada"));
    const { onDeleted } = renderScreen();
    await openDeleteConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Excluir permanentemente" }));
    await waitFor(() => expect(deleteDraft).toHaveBeenCalled());
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir este dossiê?")).toBeInTheDocument();
  });
});

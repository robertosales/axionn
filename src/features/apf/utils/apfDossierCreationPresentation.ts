import type { ApfDossierCreationSession } from "../types/apfEvidenceDossier.types";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  pending_review: "Aguardando revisão",
  reviewed: "Revisada",
  validated: "Validada",
  completed: "Concluída",
  cancelled: "Cancelada",
  blocked: "Bloqueada",
};

export function formatApfStatus(status: string) {
  return statusLabels[status] ?? status;
}

export function formatApfSessionOption(session: ApfDossierCreationSession) {
  const baseline =
    session.baselineLabel ??
    (session.baselineVersion ? `Baseline ${session.baselineVersion}` : null);

  return {
    label: [session.modelName, baseline].filter(Boolean).join(" · "),
    description: [
      session.sprintRef,
      session.releaseRef,
      formatApfStatus(session.status),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

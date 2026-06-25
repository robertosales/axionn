export type ElementaryProcessRole = "central" | "independent" | "auxiliary";
export type CountingDecision = "counted" | "absorbed" | "review_required" | "not_countable";

export interface ElementaryProcessSemantics {
  elementary_process_key: string;
  elementary_process_name: string;
  process_objective: string | null;
  process_role: ElementaryProcessRole;
  process_is_complete: boolean;
  process_is_independent: boolean;
  process_reasoning: string;
  separation_precedent_ref: string | null;
}

const AUXILIARY_TERMS = [
  "historico",
  "preview",
  "previa",
  "validacao",
  "validar",
  "mensagem",
  "carregamento",
  "loading",
  "log",
  "auditoria",
  "consultar",
  "consulta",
  "visualizar",
  "exibir",
  "listar",
];

export function normalizeElementaryProcessKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export function isAuxiliaryAction(value: string): boolean {
  const normalized = ` ${normalizeElementaryProcessKey(value).replace(/-/g, " ")} `;
  return AUXILIARY_TERMS.some((term) => normalized.includes(` ${term} `));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

export function deriveElementaryProcessSemantics(
  raw: Record<string, unknown>,
  description: string,
  baselineRef?: string | null,
): ElementaryProcessSemantics {
  const processName = String(
    raw.elementary_process_name
    ?? raw.process_name
    ?? raw.central_process
    ?? description,
  ).trim();
  const precedent = String(
    raw.separation_precedent_ref
    ?? raw.precedent_ref
    ?? baselineRef
    ?? "",
  ).trim() || null;
  const requestedRole = String(raw.process_role ?? "").toLowerCase();
  const auxiliary = isAuxiliaryAction(processName);

  let role: ElementaryProcessRole;
  if (["central", "independent", "auxiliary"].includes(requestedRole)) {
    role = requestedRole as ElementaryProcessRole;
  } else {
    role = auxiliary && !precedent ? "auxiliary" : "central";
  }

  const complete = asBoolean(raw.process_is_complete, role !== "auxiliary");
  const independent = asBoolean(raw.process_is_independent, role !== "auxiliary");
  const keySource = String(
    raw.elementary_process_key
    ?? raw.process_key
    ?? raw.central_process
    ?? processName,
  );
  const key = normalizeElementaryProcessKey(keySource || description);

  return {
    elementary_process_key: key,
    elementary_process_name: processName || description,
    process_objective: String(raw.process_objective ?? "").trim() || null,
    process_role: role,
    process_is_complete: complete,
    process_is_independent: independent,
    process_reasoning: String(
      raw.process_reasoning
      ?? raw.justification
      ?? (
        role === "auxiliary"
          ? "Ação auxiliar absorvida pelo processo central por ausência de precedente oficial de independência."
          : "Processo tratado como único, completo e independente."
      ),
    ),
    separation_precedent_ref: precedent,
  };
}

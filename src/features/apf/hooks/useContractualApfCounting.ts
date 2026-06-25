import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContractualItem, HuRow } from "../types/apfItem.types";
import type {
  BaselineCandidate,
  GenerateResponse,
  PersistSummary,
  ValidationDialogState,
  ValidationItemState,
} from "../types/apfRuntime.types";
import {
  buildStoryText,
  effectiveFactor,
  effectiveFunction,
  effectivePfBruto,
  effectivePfFs,
  extractHuRefs,
} from "../utils/contractualApf.helpers";
import {
  normalizeClassifiedItems,
  parseClassification,
} from "../utils/contractualApf.parser";
import { normalizeElementaryProcessKey } from "../utils/elementaryProcess";
import { validateContractualItems } from "../services/contractualValidation.service";
import { useApfCatalog } from "./useApfCatalog";

async function resolveActiveProviderId(): Promise<string> {
  const { data, error } = await supabase
    .from("ai_providers" as any)
    .select("id")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !(data as any)?.id) {
    throw new Error("Nenhum provedor de IA ativo foi encontrado.");
  }
  return (data as any).id;
}

async function edgeError(error: any, data?: GenerateResponse | null) {
  if ((data as any)?.error) return (data as any).error;
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      return payload?.error
        ?? payload?.userMessage
        ?? payload?.message
        ?? error.message;
    } catch {
      // Usa a mensagem padrão abaixo.
    }
  }
  return error?.message ?? "Falha ao executar a classificação APF.";
}

export function useContractualApfCounting() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const catalog = useApfCatalog(teamId);
  const [countingAll, setCountingAll] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dialog, setDialog] = useState<ValidationDialogState>({
    open: false,
    hu: null,
    items: [],
    correctionReason: "",
    correctionNotes: "",
  });

  const countForHu = useCallback(async (hu: HuRow): Promise<boolean> => {
    if (!catalog.projectId || !catalog.selectedSprint || !catalog.context) {
      toast.error("Selecione um projeto com baseline ativa antes de calcular.");
      return false;
    }

    catalog.setStories((rows) => rows.map((row) =>
      row.id === hu.id ? { ...row, _loading: true, _error: null } : row,
    ));

    try {
      const storyText = buildStoryText(hu);
      const huRefs = extractHuRefs(`${hu.title}\n${hu.description ?? ""}`);
      const huRef = huRefs[0] ?? hu.code;

      const { data: sessionId, error: sessionError } = await supabase.rpc(
        "open_counting_session" as any,
        {
          p_project_id: catalog.projectId,
          p_sprint_ref: catalog.selectedSprint.name,
          p_release_ref: null,
          p_redmine_ref: null,
          p_baseline_id: catalog.context.baseline.id,
        } as any,
      );
      if (sessionError || !sessionId) {
        throw new Error(
          sessionError?.message ?? "Não foi possível abrir a sessão APF.",
        );
      }

      let candidates: BaselineCandidate[] = [];
      let exact: BaselineCandidate[] = [];

      if (huRefs.length) {
        const { data: exactRows, error: exactError } = await supabase.rpc(
          "get_apf_baseline_exact_items" as any,
          {
            p_project_id: catalog.projectId,
            p_item_refs: huRefs,
          } as any,
        );
        if (exactError) throw new Error(exactError.message);
        exact = (exactRows ?? []) as BaselineCandidate[];

        if (!exact.length) {
          throw new Error(
            `A referência ${huRefs.join(", ")} foi encontrada na HU, mas não existe na baseline ativa. Reimporte ou corrija a baseline antes de contar.`,
          );
        }
      } else {
        const { data: candidateRows, error: candidateError } = await supabase.rpc(
          "get_apf_baseline_candidates" as any,
          {
            p_project_id: catalog.projectId,
            p_story_text: storyText,
            p_limit: 12,
          } as any,
        );
        if (candidateError) throw new Error(candidateError.message);
        candidates = (candidateRows ?? []) as BaselineCandidate[];
      }

      let classified: any[];
      let providerUsed = "Baseline determinística";
      let deterministic = false;

      if (exact.length) {
        deterministic = true;
        classified = exact.map((candidate) => ({
          baseline_item_id: candidate.id,
          hu_ref: huRef,
          ef_description: candidate.description,
          function_sigla: candidate.is_measurable
            ? candidate.function_sigla
            : "N/A",
          factor_sigla: candidate.is_measurable
            ? candidate.factor_sigla
            : "N/A",
          match_type: "baseline_exact",
          confidence: 1,
          justification:
            "Correspondência exata com item homologado na baseline ativa.",
          evidence_literal: hu.title,
          category_sigla: candidate.category_sigla,
          complexity: candidate.complexity,
          elementary_process_key: normalizeElementaryProcessKey(
            `${candidate.item_ref} ${candidate.description}`,
          ),
          elementary_process_name: candidate.description,
          process_objective: candidate.description,
          process_role: candidate.is_measurable ? "central" : "auxiliary",
          process_is_complete: candidate.is_measurable,
          process_is_independent: candidate.is_measurable,
          process_reasoning:
            "A baseline homologada reconhece esta EF como processo elementar oficial.",
          separation_precedent_ref: candidate.item_ref,
        }));
      } else {
        const providerId = await resolveActiveProviderId();
        const { data: prompt, error: promptError } = await supabase.rpc(
          "build_apf_prompt" as any,
          { p_session_id: sessionId } as any,
        );
        if (promptError || !(prompt as any)?.system_prompt) {
          throw new Error(
            promptError?.message
            ?? "Não foi possível montar o prompt contratual.",
          );
        }

        const candidateBlock = candidates.map((candidate, index) => ({
          rank: index + 1,
          baseline_item_id: candidate.id,
          item_ref: candidate.item_ref,
          description: candidate.description,
          function_sigla: candidate.function_sigla,
          factor_sigla: candidate.factor_sigla,
          pf_bruto: candidate.pf_bruto,
          pf_simples: candidate.pf_fs,
          measurable: candidate.is_measurable,
          similarity: candidate.match_score,
        }));
        const classificationPrompt = [
          String((prompt as any).system_prompt),
          "Classifique a HU usando a baseline e o modelo contratual. Não calcule PF.",
          "A HU é apenas gatilho de impacto; a unidade avaliada é a EF da baseline.",
          "Para cada item informe elementary_process_key, elementary_process_name, process_objective, process_role, process_is_complete, process_is_independent, separation_precedent_ref e process_reasoning.",
          "Itens que pertencem ao mesmo processo central devem usar a mesma elementary_process_key.",
          "Histórico, preview, validação, consulta, visualização, mensagens e carregamentos devem ser process_role=auxiliary, salvo quando a baseline ou um precedente oficial comprovar processo completo e independente.",
          `HU:\n${storyText}`,
          `CANDIDATOS DA BASELINE:\n${JSON.stringify(candidateBlock, null, 2)}`,
          "Retorne somente JSON válido. Prefira consolidar e não invente funções.",
        ].join("\n\n");

        const { data: generated, error: generationError } =
          await supabase.functions.invoke<GenerateResponse>("apf-generate", {
            body: {
              prompt: classificationPrompt,
              providerId,
              skipDocx: true,
            },
          });

        if (generationError) {
          throw new Error(await edgeError(generationError, generated));
        }
        if (!generated?.success || !generated.markdown) {
          throw new Error(
            generated?.userMessage
            ?? generated?.rawError
            ?? "A IA não retornou a classificação.",
          );
        }

        classified = normalizeClassifiedItems(
          parseClassification(generated.markdown),
          candidates,
          catalog.context,
          huRef,
        );
        providerUsed = generated.providerUsed ?? "IA";
      }

      const { data: saved, error: saveError } = await supabase.rpc(
        "save_contractual_counting_items" as any,
        {
          p_session_id: sessionId,
          p_story_id: hu.id,
          p_items: classified,
          p_ai_model: providerUsed,
        } as any,
      );
      if (saveError) throw new Error(saveError.message);

      const summary = saved as unknown as PersistSummary;
      const items = (summary.items ?? []).map((item) => ({
        ...item,
        match_confidence: item.match_confidence ?? item.confidence ?? null,
      }));
      const confidence = items.length
        ? items.reduce(
          (sum, item) => sum + Number(item.match_confidence ?? 0.5),
          0,
        ) / items.length
        : 0.5;

      catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
        ...row,
        function_points: Number(summary.story_pf_fs),
        apf_pf_bruto: Number(summary.story_pf_bruto),
        apf_pf_fs: Number(summary.story_pf_fs),
        ai_fp_confidence: confidence,
        ai_fp_validated: false,
        _items: items,
        _loading: false,
        _error: null,
        _providerUsed: providerUsed,
        _sessionId: String(summary.session_id ?? sessionId),
      } : row));

      const processNotes = [
        summary.absorbed_items
          ? `${summary.absorbed_items} ação(ões) auxiliar(es) absorvida(s)`
          : "",
        summary.review_required_items
          ? `${summary.review_required_items} processo(s) aguardando revisão`
          : "",
      ].filter(Boolean).join(" · ");

      toast.success(`${hu.code}: ${Number(summary.story_pf_fs).toFixed(2)} PF Simples`, {
        description: processNotes || (deterministic
          ? "Correspondência exata com a baseline, sem consumo de IA."
          : providerUsed),
      });
      return true;
    } catch (error: any) {
      catalog.setStories((rows) => rows.map((row) => row.id === hu.id
        ? { ...row, _loading: false, _error: error?.message ?? "Erro ao calcular" }
        : row));
      toast.error(`Erro ao calcular ${hu.code}`, { description: error?.message });
      return false;
    }
  }, [catalog.projectId, catalog.selectedSprint, catalog.context]);

  const countAll = useCallback(async () => {
    const pending = catalog.stories.filter((story) => !story.ai_fp_validated);
    if (!pending.length) return;

    setCountingAll(true);
    let successes = 0;
    const failures: string[] = [];

    for (const story of pending) {
      if (await countForHu(story)) successes += 1;
      else failures.push(story.code);
    }

    setCountingAll(false);
    if (failures.length) {
      toast.warning(`${successes} sucesso(s) e ${failures.length} falha(s)`, {
        description: failures.join(", "),
      });
    } else {
      toast.success(`${successes} HU(s) calculadas.`);
    }
  }, [catalog.stories, countForHu]);

  function openValidation(hu: HuRow) {
    if (!hu._items.length) {
      toast.warning("Calcule a HU antes de validar.");
      return;
    }
    setDialog({
      open: true,
      hu,
      items: hu._items.map((item) => ({
        ...item,
        selectedFunction: effectiveFunction(item),
        selectedFactor: effectiveFactor(item),
        selectedProcessRole: item.process_role ?? "central",
        selectedProcessComplete: item.process_is_complete ?? true,
        selectedProcessIndependent: item.process_is_independent ?? true,
        selectedProcessPrecedent: item.separation_precedent_ref ?? "",
      })),
      correctionReason: "",
      correctionNotes: "",
    });
  }

  const dialogWasCorrected = dialog.items.some((item) =>
    item.selectedFunction !== effectiveFunction(item)
    || item.selectedFactor !== effectiveFactor(item)
    || item.selectedProcessRole !== (item.process_role ?? "central")
    || item.selectedProcessComplete !== (item.process_is_complete ?? true)
    || item.selectedProcessIndependent !== (item.process_is_independent ?? true)
    || item.selectedProcessPrecedent !== (item.separation_precedent_ref ?? "")
    || item.counting_decision === "review_required",
  );

  function updateValidationItem(
    index: number,
    changes: Partial<ValidationItemState>,
  ) {
    setDialog((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  }

  const getFunctionWeight = (sigla: string) => sigla === "N/A"
    ? 0
    : Number(catalog.context?.function_types.find(
      (item) => item.sigla === sigla,
    )?.weight ?? 0);

  const getFactorPct = (sigla: string) => sigla === "N/A"
    ? 0
    : Number(catalog.context?.impact_factors.find(
      (item) => item.sigla === sigla,
    )?.contribution_pct ?? 0);

  async function confirmValidation() {
    if (!dialog.hu || !catalog.context) return;
    setValidating(true);

    try {
      const validated = await validateContractualItems({
        projectId: catalog.projectId,
        teamId,
        context: catalog.context,
        hu: dialog.hu,
        items: dialog.items,
        reason: dialog.correctionReason,
        notes: dialog.correctionNotes,
      });
      const pfBruto = validated.reduce(
        (sum, item) => sum + effectivePfBruto(item),
        0,
      );
      const pfFs = validated.reduce(
        (sum, item) => sum + effectivePfFs(item),
        0,
      );

      catalog.setStories((rows) => rows.map((row) => row.id === dialog.hu?.id ? {
        ...row,
        _items: validated,
        function_points: pfFs,
        apf_pf_bruto: pfBruto,
        apf_pf_fs: pfFs,
        ai_fp_validated: true,
      } : row));
      setDialog((current) => ({ ...current, open: false }));
      toast.success(`${dialog.hu.code} validada em ${pfFs.toFixed(2)} PF Simples.`);
    } catch (error: any) {
      toast.error("Falha ao validar", { description: error?.message });
    } finally {
      setValidating(false);
    }
  }

  const totals = useMemo(() => ({
    pfBruto: catalog.stories.reduce(
      (sum, story) => sum + Number(story.apf_pf_bruto ?? 0),
      0,
    ),
    pfFs: catalog.stories.reduce(
      (sum, story) => sum + Number(
        story.apf_pf_fs ?? story.function_points ?? 0,
      ),
      0,
    ),
    validated: catalog.stories.filter((story) => story.ai_fp_validated).length,
  }), [catalog.stories]);

  return {
    teamId,
    ...catalog,
    countingAll,
    validating,
    dialog,
    setDialog,
    dialogWasCorrected,
    updateValidationItem,
    countForHu,
    countAll,
    openValidation,
    confirmValidation,
    totals,
    getFunctionWeight,
    getFactorPct,
  };
}

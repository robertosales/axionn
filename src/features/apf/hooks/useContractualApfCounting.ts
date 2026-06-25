import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HuRow } from "../types/apfItem.types";
import type {
  GenerateResponse,
  PersistSummary,
  ProjectBaselineProcessCandidate,
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
  buildCompactProcessSelectionPrompt,
  buildProjectBaselineItems,
  hasDeterministicProcessMatch,
  inferImpactFactor,
  isAiPromptTooLarge,
  parseProcessSelection,
} from "../services/projectBaselineCounting.service";
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
        ?? payload?.rawError
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

      const { data: candidateRows, error: candidateError } = await supabase.rpc(
        "get_apf_project_process_candidates" as any,
        {
          p_project_id: catalog.projectId,
          p_story_text: storyText,
          p_limit: 6,
        } as any,
      );
      if (candidateError) throw new Error(candidateError.message);

      const candidates = (candidateRows ?? []) as ProjectBaselineProcessCandidate[];
      if (!candidates.length) {
        throw new Error(
          "Nenhum processo funcional da baseline do projeto foi relacionado a esta HU. Revise a descrição da HU ou a baseline ativa.",
        );
      }

      const allowedFactors = catalog.context.impact_factors.map((factor) => factor.sigla);
      const inferredFactor = inferImpactFactor(storyText, allowedFactors);
      let selectedProcessRefs: string[];
      let factorSigla = inferredFactor;
      let confidence: number;
      let reasoning: string;
      let providerUsed: string;
      let matchType: "baseline_process_exact" | "baseline_process_ai";
      let requiresHumanReview = false;

      if (hasDeterministicProcessMatch(candidates)) {
        const top = candidates[0];
        selectedProcessRefs = [top.process_ref];
        confidence = Number(top.match_score);
        reasoning = `O processo ${top.process_ref} apresentou correspondência lexical dominante com a HU.`;
        providerUsed = "Baseline do projeto";
        matchType = "baseline_process_exact";
      } else {
        const top = candidates[0];

        try {
          const providerId = await resolveActiveProviderId();

          const invokeSelection = async (minimal: boolean) => {
            const prompt = buildCompactProcessSelectionPrompt({
              storyText,
              candidates,
              allowedFactors,
              inferredFactor,
              minimal,
            });
            return supabase.functions.invoke<GenerateResponse>("apf-generate", {
              body: {
                prompt,
                providerId,
                skipDocx: true,
              },
            });
          };

          let { data: generated, error: generationError } = await invokeSelection(false);
          let providerFailure = generationError
            ? await edgeError(generationError, generated)
            : generated?.rawError ?? generated?.userMessage ?? "";

          if (
            (generationError || !generated?.success || !generated.markdown)
            && isAiPromptTooLarge(providerFailure)
          ) {
            const retry = await invokeSelection(true);
            generated = retry.data;
            generationError = retry.error;
            providerFailure = generationError
              ? await edgeError(generationError, generated)
              : generated?.rawError ?? generated?.userMessage ?? "";
          }

          if (generationError) {
            throw new Error(await edgeError(generationError, generated));
          }
          if (!generated?.success || !generated.markdown) {
            throw new Error(
              generated?.userMessage
              ?? generated?.rawError
              ?? "A IA não retornou os processos impactados.",
            );
          }

          const selection = parseProcessSelection(generated.markdown);
          const candidateRefs = new Set(
            candidates.map((candidate) => candidate.process_ref.toUpperCase()),
          );
          selectedProcessRefs = selection.processRefs.filter(
            (ref) => candidateRefs.has(ref),
          );
          if (!selectedProcessRefs.length) {
            throw new Error("A IA selecionou processos que não pertencem à baseline ativa.");
          }
          factorSigla = selection.factorSigla
            && allowedFactors.includes(selection.factorSigla)
            ? selection.factorSigla
            : inferredFactor;
          confidence = selection.confidence;
          reasoning = selection.reasoning;
          providerUsed = generated.providerUsed ?? "IA";
          matchType = "baseline_process_ai";
        } catch (aiError: any) {
          // A IA é mecanismo auxiliar. Uma resposta inválida não interrompe a
          // contagem: preservamos o melhor candidato da baseline sem gerar PF
          // até o analista confirmar a decisão.
          selectedProcessRefs = [top.process_ref];
          confidence = Math.min(Number(top.match_score) || 0.5, 0.69);
          reasoning = `Candidato ${top.process_ref} preservado para revisão. Motivo: ${aiError?.message ?? "resposta de IA inválida"}`;
          providerUsed = "Baseline do projeto — revisão";
          matchType = "baseline_process_ai";
          requiresHumanReview = true;
          toast.warning(`${hu.code}: revisão humana necessária`, {
            description: "O provedor não retornou JSON utilizável. O melhor candidato da baseline foi preservado sem geração automática de PF.",
          });
        }
      }

      const classified = buildProjectBaselineItems({
        candidates,
        selectedProcessRefs,
        factorSigla,
        huRef,
        evidence: storyText,
        confidence,
        reasoning,
        matchType,
        requiresHumanReview,
      });

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
      const averageConfidence = items.length
        ? items.reduce(
          (sum, item) => sum + Number(item.match_confidence ?? confidence),
          0,
        ) / items.length
        : confidence;

      catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
        ...row,
        function_points: Number(summary.story_pf_fs),
        apf_pf_bruto: Number(summary.story_pf_bruto),
        apf_pf_fs: Number(summary.story_pf_fs),
        ai_fp_confidence: averageConfidence,
        ai_fp_validated: false,
        _items: items,
        _loading: false,
        _error: null,
        _providerUsed: providerUsed,
        _sessionId: String(summary.session_id ?? sessionId),
      } : row));

      if (!requiresHumanReview) {
        toast.success(`${hu.code}: ${Number(summary.story_pf_fs).toFixed(2)} PF Simples`, {
          description: `${selectedProcessRefs.join(", ")} · fator ${factorSigla} · ${providerUsed}`,
        });
      }
      return true;
    } catch (error: any) {
      catalog.setStories((rows) => rows.map((row) => row.id === hu.id
        ? { ...row, _loading: false, _error: error?.message ?? "Erro ao calcular" }
        : row));
      toast.error(`Erro ao calcular ${hu.code}`, { description: error?.message });
      return false;
    }
  }, [catalog.projectId, catalog.selectedSprint, catalog.context]);

  const recalculateHu = useCallback(async (hu: HuRow) => {
    try {
      if (hu._sessionId) {
        const { error } = await supabase.rpc("reset_apf_story_counting" as any, {
          p_session_id: hu._sessionId,
          p_story_id: hu.id,
          p_reason: "Recálculo solicitado pelo usuário na interface.",
        } as any);
        if (error) throw error;
      }

      catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
        ...row,
        function_points: null,
        apf_pf_bruto: null,
        apf_pf_fs: null,
        ai_fp_confidence: null,
        ai_fp_validated: false,
        _items: [],
        _sessionId: null,
        _error: null,
      } : row));

      await countForHu({ ...hu, _items: [], _sessionId: null });
    } catch (error: any) {
      toast.error(`Falha ao recalcular ${hu.code}`, { description: error?.message });
    }
  }, [countForHu]);

  const countAll = useCallback(async () => {
    const pending = catalog.stories.filter((story) => story._items.length === 0);
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
    recalculateHu,
    countAll,
    openValidation,
    confirmValidation,
    totals,
    getFunctionWeight,
    getFactorPct,
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ApfContext, ContractualItem, HuRow, ProjectOption, SprintOption } from "../types/contractualApf.types";
import type { BaselineCandidate, GenerateResponse, PersistSummary, ValidationDialogState, ValidationItemState } from "../types/contractualApf.runtime.types";
import { buildStoryText, calculatePfFs, effectiveFactor, effectiveFunction, effectivePfBruto, effectivePfFs, extractHuRefs } from "../types/contractualApf.helpers";
import { normalizeClassifiedItems, parseClassification } from "../types/contractualApf.parser";

async function resolveActiveProviderId(): Promise<string | null> {
  const { data } = await supabase
    .from("ai_providers" as any)
    .select("id")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

async function edgeError(error: any, data?: any): Promise<string> {
  if (data?.error) return data.error;
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      return payload?.error ?? payload?.userMessage ?? payload?.message ?? error.message;
    } catch { /* usa fallback */ }
  }
  return error?.message ?? "Falha ao executar a contagem.";
}

export function useContractualApfCounting() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [context, setContext] = useState<ApfContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [stories, setStories] = useState<HuRow[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countingAll, setCountingAll] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dialog, setDialog] = useState<ValidationDialogState>({
    open: false, hu: null, items: [], correctionReason: "", correctionNotes: "",
  });

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [sprints, selectedSprintId],
  );

  useEffect(() => { resolveActiveProviderId().then(setActiveProviderId); }, []);

  useEffect(() => {
    if (!teamId) return;
    supabase.from("projects").select("id,name,contract_id").eq("team_id", teamId).order("name")
      .then(({ data, error }) => {
        if (error) return toast.error("Erro ao carregar projetos", { description: error.message });
        const rows = (data ?? []) as ProjectOption[];
        setProjects(rows);
        if (rows.length) setProjectId((current) => current || rows[0].id);
      });
    supabase.from("sprints").select("id,name,is_active,team_id").eq("team_id", teamId)
      .order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => {
        const rows = (data ?? []) as SprintOption[];
        setSprints(rows);
        const active = rows.find((sprint) => sprint.is_active) ?? rows[0];
        if (active) setSelectedSprintId((current) => current || active.id);
      });
  }, [teamId]);

  useEffect(() => {
    if (!projectId) return void setContext(null);
    setContextError(null);
    supabase.rpc("get_active_apf_context" as any, { p_project_id: projectId } as any)
      .then(({ data, error }) => {
        if (error) {
          setContext(null);
          setContextError(error.message);
        } else setContext(data as unknown as ApfContext);
      });
  }, [projectId]);

  const loadStories = useCallback(async () => {
    if (!teamId || !selectedSprintId) {
      setStories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("user_stories" as any)
      .select("id,code,title,description,acceptance_criteria,story_points,function_points,apf_pf_bruto,apf_pf_fs,ai_fp_confidence,ai_fp_validated")
      .eq("team_id", teamId).eq("sprint_id", selectedSprintId)
      .order("code", { ascending: true }).limit(250);
    if (error) {
      toast.error("Erro ao carregar HUs", { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data ?? []).map((row: any) => ({
      ...row,
      acceptance_criteria: row.acceptance_criteria ?? null,
      ai_fp_confidence: row.ai_fp_confidence ?? null,
      ai_fp_validated: row.ai_fp_validated ?? false,
      _items: [],
    })) as HuRow[];

    if (projectId && selectedSprint?.name) {
      const { data: session } = await supabase.from("apf_counting_sessions" as any)
        .select("id").eq("project_id", projectId).eq("sprint_ref", selectedSprint.name)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if ((session as any)?.id) {
        const { data: items } = await supabase.from("apf_counting_items" as any)
          .select("id,baseline_item_id,story_id,story_ids,hu_ref,ef_description,function_sigla,factor_sigla,pf_bruto,contribution_pct,pf_fs,match_type,match_confidence,ai_confidence_score,justification,evidence_literal,is_validated,corrected_function_sigla,corrected_factor_sigla,corrected_pf_bruto,corrected_pf_fs")
          .eq("session_id", (session as any).id).order("sort_order");
        for (const item of (items ?? []) as ContractualItem[]) {
          const ids = item.story_ids?.length ? item.story_ids : item.story_id ? [item.story_id] : [];
          ids.forEach((id) => {
            const story = rows.find((entry) => entry.id === id);
            if (story) {
              story._items.push(item);
              story._sessionId = (session as any).id;
            }
          });
        }
      }
    }
    setStories(rows);
    setLoading(false);
  }, [teamId, selectedSprintId, projectId, selectedSprint?.name]);

  useEffect(() => { loadStories(); }, [loadStories]);

  const countForHu = useCallback(async (hu: HuRow): Promise<boolean> => {
    if (!projectId || !selectedSprint || !context) {
      toast.error("Selecione um projeto com baseline ativa antes de calcular.");
      return false;
    }
    setStories((rows) => rows.map((row) => row.id === hu.id ? { ...row, _loading: true, _error: null } : row));
    try {
      const storyText = buildStoryText(hu);
      const huRefs = extractHuRefs(`${hu.title}\n${hu.description ?? ""}`);
      const huRef = huRefs[0] ?? hu.code;
      const { data: sessionId, error: sessionError } = await supabase.rpc("open_counting_session" as any, {
        p_project_id: projectId,
        p_sprint_ref: selectedSprint.name,
        p_release_ref: null,
        p_redmine_ref: null,
        p_baseline_id: context.baseline.id,
      } as any);
      if (sessionError || !sessionId) throw new Error(sessionError?.message ?? "Não foi possível abrir a sessão APF.");

      const { data: candidateRows, error: candidateError } = await supabase.rpc(
        "get_apf_baseline_candidates" as any,
        { p_project_id: projectId, p_story_text: storyText, p_limit: 12 } as any,
      );
      if (candidateError) throw new Error(candidateError.message);
      const candidates = (candidateRows ?? []) as BaselineCandidate[];
      const exact = candidates.filter((candidate) => {
        const ref = String(candidate.item_ref ?? "").toUpperCase().replace(/\s+/g, "");
        return huRefs.length ? huRefs.includes(ref) : Number(candidate.match_score) >= 0.999;
      });

      let classified: any[];
      let providerUsed = "Baseline determinística";
      let deterministic = false;
      if (exact.length) {
        deterministic = true;
        classified = exact.map((candidate) => ({
          baseline_item_id: candidate.id,
          hu_ref: huRef,
          ef_description: candidate.description,
          function_sigla: candidate.is_measurable ? candidate.function_sigla : "N/A",
          factor_sigla: candidate.is_measurable ? candidate.factor_sigla : "N/A",
          match_type: "baseline_exact",
          confidence: 1,
          justification: "Correspondência exata com item homologado na baseline ativa.",
          evidence_literal: hu.title,
          category_sigla: candidate.category_sigla,
          complexity: candidate.complexity,
        }));
      } else {
        const providerId = activeProviderId ?? await resolveActiveProviderId();
        if (!providerId) throw new Error("Nenhum provedor de IA ativo foi encontrado.");
        const { data: prompt, error: promptError } = await supabase.rpc(
          "build_apf_prompt" as any, { p_session_id: sessionId } as any,
        );
        if (promptError || !(prompt as any)?.system_prompt) {
          throw new Error(promptError?.message ?? "Não foi possível montar o prompt contratual.");
        }
        const candidateBlock = candidates.map((candidate, index) => ({
          rank: index + 1,
          baseline_item_id: candidate.id,
          item_ref: candidate.item_ref,
          description: candidate.description,
          function_sigla: candidate.function_sigla,
          factor_sigla: candidate.factor_sigla,
          measurable: candidate.is_measurable,
          similarity: candidate.match_score,
        }));
        const classificationPrompt = [
          String((prompt as any).system_prompt),
          "Classifique a HU usando a baseline e o modelo contratual. Não calcule PF.",
          `HU:\n${storyText}`,
          `CANDIDATOS DA BASELINE:\n${JSON.stringify(candidateBlock, null, 2)}`,
          "Retorne somente o JSON solicitado. Prefira consolidar e não invente funções.",
        ].join("\n\n");
        const { data: generated, error: generationError } = await supabase.functions.invoke<GenerateResponse>(
          "apf-generate", { body: { prompt: classificationPrompt, providerId, skipDocx: true } },
        );
        if (generationError) throw new Error(await edgeError(generationError, generated));
        if (!generated?.success || !generated.markdown) {
          throw new Error(generated?.userMessage ?? generated?.rawError ?? "A IA não retornou a classificação.");
        }
        classified = normalizeClassifiedItems(parseClassification(generated.markdown), candidates, context, huRef);
        providerUsed = generated.providerUsed ?? "IA";
      }

      const { data: saved, error: saveError } = await supabase.rpc("save_contractual_counting_items" as any, {
        p_session_id: sessionId,
        p_story_id: hu.id,
        p_items: classified,
        p_ai_model: providerUsed,
      } as any);
      if (saveError) throw new Error(saveError.message);
      const summary = saved as unknown as PersistSummary;
      const items = (summary.items ?? []).map((item) => ({
        ...item,
        match_confidence: item.match_confidence ?? item.confidence ?? null,
      }));
      const confidence = items.length
        ? items.reduce((sum, item) => sum + Number(item.match_confidence ?? 0.5), 0) / items.length
        : 0.5;
      setStories((rows) => rows.map((row) => row.id === hu.id ? {
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
      toast.success(`${hu.code}: ${Number(summary.story_pf_fs).toFixed(2)} PF FS`, {
        description: deterministic ? "Correspondência exata com a baseline, sem consumo de IA." : providerUsed,
      });
      return true;
    } catch (error: any) {
      setStories((rows) => rows.map((row) => row.id === hu.id
        ? { ...row, _loading: false, _error: error?.message ?? "Erro ao calcular" }
        : row));
      toast.error(`Erro ao calcular ${hu.code}`, { description: error?.message });
      return false;
    }
  }, [projectId, selectedSprint, context, activeProviderId]);

  const countAll = useCallback(async () => {
    const pending = stories.filter((story) => !story.ai_fp_validated);
    if (!pending.length) return;
    setCountingAll(true);
    let successes = 0;
    const failures: string[] = [];
    for (const story of pending) {
      if (await countForHu(story)) successes += 1;
      else failures.push(story.code);
    }
    setCountingAll(false);
    if (failures.length) toast.warning(`${successes} sucesso(s) e ${failures.length} falha(s)`, { description: failures.join(", ") });
    else toast.success(`${successes} HU(s) calculadas.`);
  }, [stories, countForHu]);

  function openValidation(hu: HuRow) {
    if (!hu._items.length) return toast.warning("Calcule a HU antes de validar.");
    setDialog({
      open: true,
      hu,
      items: hu._items.map((item) => ({
        ...item,
        selectedFunction: effectiveFunction(item),
        selectedFactor: effectiveFactor(item),
      })),
      correctionReason: "",
      correctionNotes: "",
    });
  }

  const dialogWasCorrected = dialog.items.some((item) =>
    item.selectedFunction !== effectiveFunction(item) || item.selectedFactor !== effectiveFactor(item));

  function updateValidationItem(index: number, changes: Partial<ValidationItemState>) {
    setDialog((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    }));
  }

  const getFunctionWeight = (sigla: string) => sigla === "N/A" ? 0
    : Number(context?.function_types.find((item) => item.sigla === sigla)?.weight ?? 0);
  const getFactorPct = (sigla: string) => sigla === "N/A" ? 0
    : Number(context?.impact_factors.find((item) => item.sigla === sigla)?.contribution_pct ?? 0);

  async function confirmValidation() {
    if (!dialog.hu) return;
    if (dialogWasCorrected && !dialog.correctionReason) return toast.warning("Informe o motivo da correção.");
    setValidating(true);
    try {
      const validated: ContractualItem[] = [];
      for (const item of dialog.items) {
        const weight = getFunctionWeight(item.selectedFunction);
        const pct = getFactorPct(item.selectedFactor);
        const pfFs = calculatePfFs(weight, pct);
        const changed = item.selectedFunction !== effectiveFunction(item)
          || item.selectedFactor !== effectiveFactor(item)
          || pfFs !== effectivePfFs(item);
        const { data, error } = await supabase.rpc("validate_apf_counting_item" as any, {
          p_item_id: item.id,
          p_function_sigla: item.selectedFunction,
          p_factor_sigla: item.selectedFactor,
          p_reason: changed ? dialog.correctionReason : null,
          p_notes: dialog.correctionNotes || null,
        } as any);
        if (error) throw error;
        validated.push({
          ...item,
          is_validated: true,
          corrected_function_sigla: changed ? item.selectedFunction : null,
          corrected_factor_sigla: changed ? item.selectedFactor : null,
          corrected_pf_bruto: changed ? Number((data as any)?.pf_bruto ?? weight) : null,
          corrected_pf_fs: changed ? Number((data as any)?.pf_fs ?? pfFs) : null,
        });
        await supabase.functions.invoke("apf-validate", { body: {
          counting_item_id: item.id,
          session_id: dialog.hu._sessionId,
          project_id: projectId,
          team_id: teamId,
          baseline_item_id: item.baseline_item_id,
          hu_text: buildStoryText(dialog.hu),
          hu_title: dialog.hu.title,
          ai_functional_type: item.function_sigla,
          ai_factor_sigla: item.factor_sigla,
          ai_complexity: "Padrão",
          ai_pf_bruto: item.pf_bruto,
          ai_pf_fs: item.pf_fs,
          ai_confidence_score: item.match_confidence ?? item.confidence ?? null,
          ai_reasoning: item.justification,
          validated_functional_type: item.selectedFunction,
          validated_factor_sigla: item.selectedFactor,
          validated_complexity: "Padrão",
          validated_pf_bruto: weight,
          validated_pf_fs: pfFs,
          correction_reason_code: changed ? dialog.correctionReason : undefined,
          correction_notes: dialog.correctionNotes || undefined,
        }});
      }
      const pfBruto = validated.reduce((sum, item) => sum + effectivePfBruto(item), 0);
      const pfFs = validated.reduce((sum, item) => sum + effectivePfFs(item), 0);
      setStories((rows) => rows.map((row) => row.id === dialog.hu?.id ? {
        ...row, _items: validated, function_points: pfFs,
        apf_pf_bruto: pfBruto, apf_pf_fs: pfFs, ai_fp_validated: true,
      } : row));
      setDialog((current) => ({ ...current, open: false }));
      toast.success(`${dialog.hu.code} validada em ${pfFs.toFixed(2)} PF FS.`);
    } catch (error: any) {
      toast.error("Falha ao validar", { description: error?.message });
    } finally {
      setValidating(false);
    }
  }

  const totals = useMemo(() => ({
    pfBruto: stories.reduce((sum, story) => sum + Number(story.apf_pf_bruto ?? 0), 0),
    pfFs: stories.reduce((sum, story) => sum + Number(story.apf_pf_fs ?? story.function_points ?? 0), 0),
    validated: stories.filter((story) => story.ai_fp_validated).length,
  }), [stories]);

  return {
    teamId, projects, projectId, setProjectId, context, contextError,
    sprints, selectedSprintId, setSelectedSprintId, stories,
    loading, countingAll, validating, dialog, setDialog,
    dialogWasCorrected, updateValidationItem, countForHu, countAll,
    openValidation, confirmValidation, loadStories, totals,
    getFunctionWeight, getFactorPct,
  };
}

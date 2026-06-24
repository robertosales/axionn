import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { HuRow } from "../types/apfItem.types";
import type { ValidationDialogState, ValidationItemState } from "../types/apfRuntime.types";
import { effectiveFactor, effectiveFunction, effectivePfBruto, effectivePfFs } from "../utils/contractualApf.helpers";
import { countHuContractually } from "../services/contractualCounting.service";
import { validateContractualItems } from "../services/contractualValidation.service";
import { useApfCatalog } from "./useApfCatalog";

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
      const result = await countHuContractually({
        projectId: catalog.projectId,
        sprintName: catalog.selectedSprint.name,
        context: catalog.context,
        hu,
      });
      const confidence = result.items.length
        ? result.items.reduce((sum, item) => sum + Number(item.match_confidence ?? 0.5), 0) / result.items.length
        : 0.5;

      catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
        ...row,
        function_points: Number(result.summary.story_pf_fs),
        apf_pf_bruto: Number(result.summary.story_pf_bruto),
        apf_pf_fs: Number(result.summary.story_pf_fs),
        ai_fp_confidence: confidence,
        ai_fp_validated: false,
        _items: result.items,
        _loading: false,
        _error: null,
        _providerUsed: result.providerUsed,
        _sessionId: String(result.summary.session_id),
      } : row));

      toast.success(`${hu.code}: ${Number(result.summary.story_pf_fs).toFixed(2)} PF FS`, {
        description: result.deterministic
          ? "Correspondência exata com a baseline, sem consumo de IA."
          : result.providerUsed,
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
      })),
      correctionReason: "",
      correctionNotes: "",
    });
  }

  const dialogWasCorrected = dialog.items.some((item) =>
    item.selectedFunction !== effectiveFunction(item)
    || item.selectedFactor !== effectiveFactor(item),
  );

  function updateValidationItem(index: number, changes: Partial<ValidationItemState>) {
    setDialog((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  }

  const getFunctionWeight = (sigla: string) => sigla === "N/A" ? 0
    : Number(catalog.context?.function_types.find((item) => item.sigla === sigla)?.weight ?? 0);
  const getFactorPct = (sigla: string) => sigla === "N/A" ? 0
    : Number(catalog.context?.impact_factors.find((item) => item.sigla === sigla)?.contribution_pct ?? 0);

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
      const pfBruto = validated.reduce((sum, item) => sum + effectivePfBruto(item), 0);
      const pfFs = validated.reduce((sum, item) => sum + effectivePfFs(item), 0);

      catalog.setStories((rows) => rows.map((row) => row.id === dialog.hu?.id ? {
        ...row,
        _items: validated,
        function_points: pfFs,
        apf_pf_bruto: pfBruto,
        apf_pf_fs: pfFs,
        ai_fp_validated: true,
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
    pfBruto: catalog.stories.reduce((sum, story) => sum + Number(story.apf_pf_bruto ?? 0), 0),
    pfFs: catalog.stories.reduce((sum, story) => sum + Number(story.apf_pf_fs ?? story.function_points ?? 0), 0),
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

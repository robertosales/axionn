import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContractualItem, HuRow } from "../types/apfItem.types";
import type {
  ValidationDialogState,
  ValidationItemState,
} from "../types/apfRuntime.types";
import {
  effectiveFactor,
  effectiveFunction,
  effectivePfBruto,
  effectivePfFs,
} from "../utils/contractualApf.helpers";
import { validateContractualItems } from "../services/contractualValidation.service";
import { useApfCatalog } from "./useApfCatalog";

interface CountResponse {
  success?: boolean;
  error?: string;
  session_id: string;
  story_pf_bruto: number;
  story_pf_fs: number;
  items: ContractualItem[];
  provider_used?: string;
  deterministic_match?: boolean;
}

async function readFunctionError(error: any, data?: CountResponse | null) {
  if (data?.error) return data.error;
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      return payload?.error ?? payload?.message ?? error.message;
    } catch {
      // Usa a mensagem padrão abaixo.
    }
  }
  return error?.message ?? "Falha ao executar a contagem APF.";
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
      const { data, error } = await supabase.functions.invoke<CountResponse>(
        "apf-count",
        {
          body: {
            project_id: catalog.projectId,
            story_id: hu.id,
            sprint_ref: catalog.selectedSprint.name,
            baseline_id: catalog.context.baseline.id,
          },
        },
      );

      if (error || !data?.success) {
        throw new Error(await readFunctionError(error, data));
      }

      const items = (data.items ?? []).map((item) => ({
        ...item,
        match_confidence: item.match_confidence ?? item.confidence ?? null,
      }));
      const confidence = items.length
        ? items.reduce(
          (sum, item) => sum + Number(item.match_confidence ?? 0.5),
          0,
        ) / items.length
        : 0.5;
      const providerUsed = data.provider_used ?? "Motor APF";

      catalog.setStories((rows) => rows.map((row) => row.id === hu.id ? {
        ...row,
        function_points: Number(data.story_pf_fs),
        apf_pf_bruto: Number(data.story_pf_bruto),
        apf_pf_fs: Number(data.story_pf_fs),
        ai_fp_confidence: confidence,
        ai_fp_validated: false,
        _items: items,
        _loading: false,
        _error: null,
        _providerUsed: providerUsed,
        _sessionId: String(data.session_id),
      } : row));

      toast.success(`${hu.code}: ${Number(data.story_pf_fs).toFixed(2)} PF FS`, {
        description: data.deterministic_match
          ? "Correspondência exata com a baseline, sem consumo de IA."
          : providerUsed,
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
      toast.success(`${dialog.hu.code} validada em ${pfFs.toFixed(2)} PF FS.`);
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

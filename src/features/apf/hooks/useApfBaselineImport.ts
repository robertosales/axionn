import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ParsedApfBaselineWorkbook,
  parseApfBaselineArrayBuffer,
} from "../services/apfBaselineParser";
import {
  ApfBaselineIntegrityReport,
  validateApfBaselineIntegrity,
} from "../services/apfBaselineIntegrity";

export interface BaselineProject { id: string; name: string; contract_id: string | null }
export interface BaselineRow {
  id: string;
  version: string;
  label: string | null;
  status: string;
  scope_type?: string | null;
  source_file_name?: string | null;
  source_summary?: Record<string, unknown> | null;
  imported_at: string | null;
  created_at: string;
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function useApfBaselineImport() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const [projects, setProjects] = useState<BaselineProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  const [parsed, setParsed] = useState<ParsedApfBaselineWorkbook | null>(null);
  const [integrity, setIntegrity] = useState<ApfBaselineIntegrityReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileChecksum, setFileChecksum] = useState("");
  const [version, setVersion] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    supabase.from("projects").select("id,name,contract_id").eq("team_id", teamId).order("name")
      .then(({ data, error }) => {
        if (error) return toast.error("Não foi possível carregar os projetos", { description: error.message });
        const rows = (data ?? []) as BaselineProject[];
        setProjects(rows);
        if (rows.length) setProjectId((current) => current || rows[0].id);
      });
  }, [teamId]);

  async function refreshBaselines(targetProjectId = projectId) {
    if (!targetProjectId) return void setBaselines([]);
    setLoading(true);
    const { data, error } = await supabase.from("apf_project_baselines" as any)
      .select("id,version,label,status,scope_type,source_file_name,source_summary,imported_at,created_at")
      .eq("project_id", targetProjectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar baselines", { description: error.message });
    setBaselines((data ?? []) as BaselineRow[]);
    setLoading(false);
  }

  useEffect(() => { refreshBaselines(projectId); }, [projectId]);

  async function handleFile(file: File | null) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const result = parseApfBaselineArrayBuffer(buffer);
      const report = validateApfBaselineIntegrity(result);
      const checksum = await sha256(buffer);

      setParsed(result);
      setIntegrity(report);
      setFileName(file.name);
      setFileChecksum(checksum);
      const date = new Date().toISOString().slice(0, 10);
      const system = result.systemName?.replace(/\s+/g, "-") ?? "projeto";
      setVersion(`${system}-${date}`);
      setLabel(result.measurementTitle ?? `Baseline do projeto ${result.systemName ?? "Sistema"}`);

      if (report.errors.length) {
        toast.error("Baseline reprovada na validação", {
          description: report.errors.join(" "),
        });
      } else if (report.warnings.length) {
        toast.warning("Baseline de projeto válida com observações", {
          description: report.warnings.join(" "),
        });
      } else {
        toast.success("Baseline de projeto validada e pronta para importação");
      }
    } catch (error: any) {
      setParsed(null);
      setIntegrity(null);
      setFileChecksum("");
      toast.error("Planilha incompatível", { description: error?.message });
    }
  }

  async function importBaseline() {
    if (!projectId || !parsed || !integrity || !version.trim()) return;
    if (integrity.errors.length) {
      toast.error("A baseline não pode ser ativada", {
        description: "Corrija as divergências da planilha antes de importar.",
      });
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.rpc("apf_import_project_baseline" as any, {
        p_project_id: projectId,
        p_version: version.trim(),
        p_label: label.trim() || null,
        p_source_name: fileName || null,
        p_items: parsed.items,
        p_function_types: parsed.functionTypes,
        p_impact_factors: parsed.impactFactors,
        p_source_summary: {
          scope_type: "project",
          system_name: parsed.systemName,
          measurement_title: parsed.measurementTitle,
          reference_date: parsed.referenceDate,
          expected_pf_bruto: parsed.expectedPfBruto,
          expected_pf_fs: parsed.expectedPfFs,
          calculated_pf_bruto: integrity.calculatedPfBruto,
          calculated_pf_simples: integrity.calculatedPfSimples,
          item_count: integrity.itemCount,
          process_count: integrity.processCount,
          measurable_count: integrity.measurableCount,
          non_measurable_count: integrity.nonMeasurableCount,
          source_checksum: fileChecksum,
          warnings: integrity.warnings,
          validation_errors: integrity.errors,
        },
        p_activate: true,
      } as any);
      if (error) throw error;

      const imported = data as any;
      if (
        Number(imported?.inserted_items) !== integrity.itemCount
        || Number(imported?.process_count) !== integrity.processCount
        || Math.abs(Number(imported?.total_pf_bruto) - integrity.calculatedPfBruto) > 0.02
        || Math.abs(Number(imported?.total_pf_fs) - integrity.calculatedPfSimples) > 0.02
      ) {
        throw new Error("A conferência pós-importação retornou dados diferentes da prévia.");
      }

      toast.success("Baseline do projeto importada e ativada", {
        description: `${imported.process_count} processos · ${imported.inserted_items} itens · PF Bruto ${Number(imported.total_pf_bruto).toFixed(2)}.`,
      });
      setParsed(null);
      setIntegrity(null);
      setFileName("");
      setFileChecksum("");
      await refreshBaselines();
    } catch (error: any) {
      toast.error("Falha ao importar a baseline", { description: error?.message });
    } finally {
      setImporting(false);
    }
  }

  async function deleteBaseline(row: BaselineRow) {
    setDeletingId(row.id);
    try {
      const { data, error } = await supabase.rpc("delete_apf_project_baseline" as any, {
        p_baseline_id: row.id,
      } as any);
      if (error) throw error;

      const result = data as any;
      toast.success("Baseline removida", {
        description: result?.mode === "archived_for_audit"
          ? "A baseline foi retirada da operação e preservada para auditoria das contagens anteriores."
          : "A baseline e seus itens foram excluídos.",
      });
      await refreshBaselines();
    } catch (error: any) {
      toast.error("Falha ao excluir a baseline", { description: error?.message });
    } finally {
      setDeletingId(null);
    }
  }

  const totals = useMemo(() => parsed ? {
    processes: parsed.processCount,
    measurable: parsed.items.filter((item) => item.is_measurable).length,
    nonMeasurable: parsed.items.filter((item) => !item.is_measurable).length,
    pfBruto: parsed.items.reduce((sum, item) => sum + item.pf_bruto, 0),
    pfFs: parsed.items.reduce((sum, item) => sum + item.pf_fs, 0),
  } : null, [parsed]);

  return {
    projects, projectId, setProjectId, baselines, parsed, integrity, fileName,
    version, setVersion, label, setLabel, loading, importing, deletingId,
    handleFile, importBaseline, deleteBaseline, totals,
  };
}

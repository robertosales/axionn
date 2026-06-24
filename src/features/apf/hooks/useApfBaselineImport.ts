import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ParsedApfBaselineWorkbook,
  parseApfBaselineArrayBuffer,
} from "../services/apfBaselineParser";

export interface BaselineProject { id: string; name: string; contract_id: string | null }
export interface BaselineRow {
  id: string;
  version: string;
  label: string | null;
  status: string;
  source_file_name?: string | null;
  source_summary?: Record<string, unknown> | null;
  imported_at: string | null;
  created_at: string;
}

export function useApfBaselineImport() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const [projects, setProjects] = useState<BaselineProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  const [parsed, setParsed] = useState<ParsedApfBaselineWorkbook | null>(null);
  const [fileName, setFileName] = useState("");
  const [version, setVersion] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

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
      .select("id,version,label,status,source_file_name,source_summary,imported_at,created_at")
      .eq("project_id", targetProjectId).order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar baselines", { description: error.message });
    setBaselines((data ?? []) as BaselineRow[]);
    setLoading(false);
  }

  useEffect(() => { refreshBaselines(projectId); }, [projectId]);

  async function handleFile(file: File | null) {
    if (!file) return;
    try {
      const result = parseApfBaselineArrayBuffer(await file.arrayBuffer());
      setParsed(result);
      setFileName(file.name);
      const suggestion = file.name.match(/Sprint\s*\d+.*Release\s*\d+/i)?.[0]
        ?? new Date().toISOString().slice(0, 10);
      setVersion(suggestion.replace(/\s+/g, "-"));
      setLabel(result.measurementTitle ?? `${result.systemName ?? "Sistema"} — ${suggestion}`);
      if (result.warnings.length) toast.warning("Planilha carregada com alertas", { description: result.warnings.join(" ") });
      else toast.success("Planilha validada e pronta para importação");
    } catch (error: any) {
      setParsed(null);
      toast.error("Planilha incompatível", { description: error?.message });
    }
  }

  async function importBaseline() {
    if (!projectId || !parsed || !version.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.rpc("apf_import_baseline" as any, {
        p_project_id: projectId,
        p_version: version.trim(),
        p_label: label.trim() || null,
        p_source_name: fileName || null,
        p_items: parsed.items,
        p_function_types: parsed.functionTypes,
        p_impact_factors: parsed.impactFactors,
        p_source_summary: {
          system_name: parsed.systemName,
          measurement_title: parsed.measurementTitle,
          reference_date: parsed.referenceDate,
          expected_pf_bruto: parsed.expectedPfBruto,
          expected_pf_fs: parsed.expectedPfFs,
          warnings: parsed.warnings,
        },
        p_activate: true,
      } as any);
      if (error) throw error;
      toast.success("Baseline importada e ativada", {
        description: `${(data as any)?.inserted_items ?? parsed.items.length} itens processados.`,
      });
      setParsed(null);
      setFileName("");
      await refreshBaselines();
    } catch (error: any) {
      toast.error("Falha ao importar a baseline", { description: error?.message });
    } finally {
      setImporting(false);
    }
  }

  const totals = useMemo(() => parsed ? {
    measurable: parsed.items.filter((item) => item.is_measurable).length,
    nonMeasurable: parsed.items.filter((item) => !item.is_measurable).length,
    pfBruto: parsed.items.reduce((sum, item) => sum + item.pf_bruto, 0),
    pfFs: parsed.items.reduce((sum, item) => sum + item.pf_fs, 0),
  } : null, [parsed]);

  return {
    projects, projectId, setProjectId, baselines, parsed, fileName,
    version, setVersion, label, setLabel, loading, importing,
    handleFile, importBaseline, totals,
  };
}

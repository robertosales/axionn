import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import {
  fetchActiveTemplates,
  fetchGenerations,
  createGeneration,
  invokeApfGeneration,
  prepareFilesForEdgeFunction,
  type ApfTemplate,
  type ApfGeneration,
} from "../services/apf.service";
import { supabase } from "@/integrations/supabase/client";

export type Provider = "lovable" | "openai" | "gemini" | "anthropic" | "perplexity";
export type OutputFormat = "docx" | "markdown";

/** Etapas visíveis de progresso (P5) */
export type ProgressStep =
  | "idle"
  | "reading_files"    // Etapa 1: lendo xlsx + docx
  | "calling_ai"       // Etapa 2: chamando a IA
  | "saving"           // Etapa 3: salvando resultado
  | "done";

export const PROGRESS_LABELS: Record<ProgressStep, string> = {
  idle: "",
  reading_files: "Lendo arquivos (Baseline + Modelo)...",
  calling_ai: "Gerando documento com IA...",
  saving: "Salvando resultado...",
  done: "Concluído!",
};

export const PROVIDERS: { value: Provider; label: string; needsKey: boolean; placeholder: string }[] = [
  { value: "lovable",     label: "Lovable AI (Gemini/GPT) — recomendado", needsKey: false, placeholder: "" },
  { value: "openai",      label: "OpenAI (GPT)",      needsKey: true, placeholder: "sk-..." },
  { value: "gemini",      label: "Google Gemini",     needsKey: true, placeholder: "AIza..." },
  { value: "anthropic",   label: "Anthropic (Claude)",needsKey: true, placeholder: "sk-ant-..." },
  { value: "perplexity",  label: "Perplexity",        needsKey: true, placeholder: "pplx-..." },
];

export type InteractiveQuestion = {
  id: string;
  text: string;
  kind: "yesno" | "open";
  followUp?: string;
};

export const YESNO_REGEX =
  /\(\s*(sim|s)\s*\/\s*(n[ãa]o|n)\s*\)|\[\s*(sim|s)\s*\/\s*(n[ãa]o|n)\s*\]/i;

export function detectInteractiveQuestions(prompt: string): InteractiveQuestion[] {
  if (!prompt) return [];
  const lines = prompt.split(/\r?\n/);
  const questions: InteractiveQuestion[] = [];
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    if (YESNO_REGEX.test(line) && /\?/.test(line)) {
      const next = (lines[idx + 1] ?? "").trim();
      const followUp =
        /^se\s+sim/i.test(next) || /descreva|informe|detalhe/i.test(next)
          ? next
          : "Descreva o que foi alterado";
      questions.push({ id: `q_${idx}`, text: line, kind: "yesno", followUp });
      return;
    }
    const open = line.match(/\{\{\s*pergunta\s*:\s*(.+?)\s*\}\}/i);
    if (open) questions.push({ id: `q_${idx}`, text: open[1], kind: "open" });
  });
  return questions;
}

export function applyAnswersToPrompt(
  prompt: string,
  questions: InteractiveQuestion[],
  answers: Record<string, { value: string; detail?: string }>,
): string {
  if (questions.length === 0) return prompt;
  const summary = questions
    .map((q) => {
      const a = answers[q.id];
      if (!a) return `- ${q.text}\n  Resposta: (não informada)`;
      if (q.kind === "yesno") {
        const isYes = a.value === "sim";
        const detail = isYes && a.detail?.trim() ? `\n  Detalhes: ${a.detail.trim()}` : "";
        return `- ${q.text}\n  Resposta: ${isYes ? "Sim" : "Não"}${detail}`;
      }
      return `- ${q.text}\n  Resposta: ${a.value || "(vazio)"}`;
    })
    .join("\n");
  const stripped = prompt
    .split(/\r?\n/)
    .filter((l) => !YESNO_REGEX.test(l) && !/\{\{\s*pergunta\s*:/i.test(l))
    .join("\n");
  return `${stripped}\n\n=== RESPOSTAS DO USUÁRIO ===\n${summary}\n=== FIM DAS RESPOSTAS ===\n\nIMPORTANTE: Use as respostas acima como dados confirmados pelo usuário. NÃO repita as perguntas no documento — incorpore as respostas naturalmente no conteúdo gerado.`;
}

export function useApfGenerate() {
  const { currentTeamId, user } = useAuth();
  const { sprints } = useSprint();

  const [selectedSprintId, setSelectedSprintId]     = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templates, setTemplates]                   = useState<ApfTemplate[]>([]);
  const [baselineFile, setBaselineFile]             = useState<File | null>(null);
  const [huFiles, setHuFiles]                       = useState<File[]>([]);
  const [modelFile, setModelFile]                   = useState<File | null>(null);
  const [generating, setGenerating]                 = useState(false);
  const [progressStep, setProgressStep]             = useState<ProgressStep>("idle");
  const [generations, setGenerations]               = useState<(ApfGeneration & { template_name?: string })[]>([]);
  const [loadingHistory, setLoadingHistory]         = useState(false);
  const [provider, setProvider]                     = useState<Provider>("lovable");
  const [apiKey, setApiKey]                         = useState("");
  const [outputFormat, setOutputFormat]             = useState<OutputFormat>("docx");
  const [lastResult, setLastResult] = useState<{
    base64: string;
    markdown: string;
    baseFilename: string;
    pfBreakdown: Record<string, number>;
    pfTotal: number | null;
  } | null>(null);
  const [showPreview, setShowPreview]   = useState(false);
  const [questions, setQuestions]       = useState<InteractiveQuestion[]>([]);
  const [answers, setAnswers]           = useState<Record<string, { value: string; detail?: string }>>({});
  const [showQuestions, setShowQuestions] = useState(false);

  // Carregar templates
  useEffect(() => {
    if (!currentTeamId) return;
    fetchActiveTemplates(currentTeamId).then(setTemplates).catch(() => {});
  }, [currentTeamId]);

  // Recarregar histórico quando sprint muda
  useEffect(() => {
    if (!currentTeamId || !selectedSprintId) { setGenerations([]); return; }
    setLoadingHistory(true);
    fetchGenerations(currentTeamId, selectedSprintId)
      .then(setGenerations)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [currentTeamId, selectedSprintId]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  useEffect(() => {
    if (!selectedTemplate) { setQuestions([]); setAnswers({}); return; }
    setQuestions(detectInteractiveQuestions(selectedTemplate.prompt_content));
    setAnswers({});
  }, [selectedTemplate]);

  const providerCfg   = PROVIDERS.find((p) => p.value === provider)!;
  const apiKeyOk      = !providerCfg.needsKey || apiKey.trim().length > 0;
  const canGenerate   = !!selectedSprintId && !!selectedTemplateId && !!baselineFile && huFiles.length > 0 && !!modelFile && apiKeyOk;
  const allQuestionsAnswered = questions.every((q) => {
    const a = answers[q.id];
    if (!a || !a.value) return false;
    if (q.kind === "yesno" && a.value === "sim" && !a.detail?.trim()) return false;
    return true;
  });

  const runGeneration = useCallback(async () => {
    if (!currentTeamId || !user) { toast.error("Sessão inválida. Faça login novamente."); return; }

    const missing: string[] = [];
    if (!selectedSprintId)    missing.push("Sprint");
    if (!selectedTemplateId)  missing.push("Template");
    if (!baselineFile)        missing.push("Baseline");
    if (huFiles.length === 0) missing.push("HUs da Sprint");
    if (!modelFile)           missing.push("Modelo de Contagem");
    if (!apiKeyOk)            missing.push("API Key do provedor");
    if (missing.length > 0) { toast.error(`Preencha antes de gerar: ${missing.join(", ")}`); return; }

    setGenerating(true);
    let generationId: string | undefined;

    try {
      const sprint       = sprints.find((s) => s.id === selectedSprintId);
      const baseFilename = `APF_${(sprint?.name ?? "Sprint").replace(/\s+/g, "_")}_${Date.now()}`;
      const filename     = `${baseFilename}.${outputFormat === "docx" ? "docx" : "md"}`;

      // ── ETAPA 1: Criar registro no banco com status=pending ──
      // Feito ANTES da IA para garantir persistência mesmo se falhar
      const gen = await createGeneration({
        team_id:       currentTeamId,
        template_id:   selectedTemplateId,
        sprint_id:     selectedSprintId,
        generated_by:  user.id,
        baseline_file: baselineFile!.name,
        hu_file:       huFiles.map((f) => f.name).join(", "),
        model_file:    modelFile!.name,
        output_filename: filename,
        status: "pending",
      });
      generationId = gen.id;

      // ── ETAPA 2: Ler e converter arquivos para base64 (xlsx/docx) ──
      setProgressStep("reading_files");
      const allFiles   = [baselineFile!, ...huFiles, modelFile!];
      const filePayload = await prepareFilesForEdgeFunction(allFiles);

      const finalPrompt = applyAnswersToPrompt(
        selectedTemplate!.prompt_content,
        questions,
        answers,
      );

      // ── ETAPA 3: Chamar a IA ──
      setProgressStep("calling_ai");
      const result = await invokeApfGeneration({
        prompt:       finalPrompt,
        provider,
        apiKey:       providerCfg.needsKey ? apiKey.trim() : undefined,
        files:        filePayload,
        generationId, // Edge Function salva o resultado automaticamente
      });

      // ── ETAPA 4: Finalizar ──
      setProgressStep("saving");
      setLastResult({
        base64:      result.docxBase64,
        markdown:    result.markdown,
        baseFilename,
        pfBreakdown: result.pfBreakdown,
        pfTotal:     result.pfTotal,
      });
      setShowPreview(true);

      // Recarregar histórico (a Edge Function já atualizou o status para success)
      const updated = await fetchGenerations(currentTeamId, selectedSprintId);
      setGenerations(updated);

      setProgressStep("done");
      toast.success("Documento gerado! Visualize e baixe no formato desejado.");
    } catch (e: any) {
      console.error("Erro ao gerar APF:", e);
      // Marcar registro como error no banco se já foi criado
      if (generationId) {
        await supabase
          .from("apf_generations")
          .update({ status: "error", error_message: e?.message ?? "Erro desconhecido" })
          .eq("id", generationId)
          .catch(() => {});
        const updated = await fetchGenerations(currentTeamId!, selectedSprintId);
        setGenerations(updated);
      }
      toast.error(e?.message ?? "Erro ao gerar documento");
    } finally {
      setGenerating(false);
      setShowQuestions(false);
      setTimeout(() => setProgressStep("idle"), 2000);
    }
  }, [
    currentTeamId, user,
    selectedSprintId, selectedTemplateId,
    baselineFile, huFiles, modelFile,
    apiKeyOk, sprints, outputFormat,
    selectedTemplate, questions, answers,
    provider, providerCfg.needsKey, apiKey,
  ]);

  const handleGenerateClick = useCallback(() => {
    if (!canGenerate) return;
    if (questions.length > 0 && !allQuestionsAnswered) { setShowQuestions(true); return; }
    void runGeneration();
  }, [canGenerate, questions.length, allQuestionsAnswered, runGeneration]);

  return {
    sprints,
    selectedSprintId, setSelectedSprintId,
    selectedTemplateId, setSelectedTemplateId,
    templates, selectedTemplate,
    baselineFile, setBaselineFile,
    huFiles, setHuFiles,
    modelFile, setModelFile,
    provider, setProvider, providerCfg,
    apiKey, setApiKey, apiKeyOk,
    outputFormat, setOutputFormat,
    generating, canGenerate,
    progressStep,
    handleGenerateClick, runGeneration,
    generations, loadingHistory,
    lastResult, showPreview, setShowPreview,
    questions, answers, setAnswers,
    showQuestions, setShowQuestions,
    allQuestionsAnswered,
  };
}

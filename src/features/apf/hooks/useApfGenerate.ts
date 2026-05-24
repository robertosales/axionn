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
import { listAIProviders, type AIProvider } from "@/features/admin/services/aiProviders.service";

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

/**
 * SEC-005: needsKey REMOVIDO de todos os providers.
 * As API keys são gerenciadas pelo admin via Supabase Vault.
 * O usuário final nunca precisa inserir ou conhecer as keys.
 */
// Mantido apenas para fallback/legado — a lista real vem do banco
export const PROVIDERS: { value: Provider; label: string }[] = [];

export type InteractiveQuestion = {
  id: string;
  text: string;
  kind: "yesno" | "open";
  followUp?: string;
  allowSqlFiles?: boolean;
};

const DEFAULT_DB_CHANGE_QUESTION: InteractiveQuestion = {
  id: "q_db_changes",
  text: "Houve alteração de banco de dados?",
  kind: "yesno",
  followUp: "Descreva as alterações de banco e anexe os scripts SQL Server, se houver.",
  allowSqlFiles: true,
};

const INLINE_AI_PROVIDERS: AIProvider[] = [
  { id: "inline:openai", name: "OpenAI — informar chave agora", provider_type: "openai", model: "gpt-4o-mini", is_recommended: false, is_active: true, has_key: false, created_at: "", updated_at: "" },
  { id: "inline:gemini", name: "Google Gemini — informar chave agora", provider_type: "gemini", model: "gemini-2.0-flash", is_recommended: false, is_active: true, has_key: false, created_at: "", updated_at: "" },
  { id: "inline:anthropic", name: "Anthropic Claude — informar chave agora", provider_type: "anthropic", model: "claude-3-5-sonnet-20241022", is_recommended: false, is_active: true, has_key: false, created_at: "", updated_at: "" },
];

export const YESNO_REGEX =
  /\(\s*(sim|s)\s*\/\s*(n[\u00e3a]o|n)\s*\)|\[\s*(sim|s)\s*\/\s*(n[\u00e3a]o|n)\s*\]/i;

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
  const hasDbChangeQuestion = questions.some((q) => /banco|dados|database|sql/i.test(q.text));
  if (!hasDbChangeQuestion) questions.push(DEFAULT_DB_CHANGE_QUESTION);
  return questions;
}

export function applyAnswersToPrompt(
  prompt: string,
  questions: InteractiveQuestion[],
  answers: Record<string, { value: string; detail?: string }>,
  sqlFileNames: string[] = [],
): string {
  if (questions.length === 0) return prompt;
  const summary = questions
    .map((q) => {
      const a = answers[q.id];
      if (!a) return `- ${q.text}\n  Resposta: (n\u00e3o informada)`;
      if (q.kind === "yesno") {
        const isYes = a.value === "sim";
        const detail = isYes && a.detail?.trim() ? `\n  Detalhes: ${a.detail.trim()}` : "";
        const scripts = isYes && q.allowSqlFiles && sqlFileNames.length > 0
          ? `\n  Scripts SQL Server anexados: ${sqlFileNames.join(", ")}`
          : "";
        return `- ${q.text}\n  Resposta: ${isYes ? "Sim" : "N\u00e3o"}${detail}${scripts}`;
      }
      return `- ${q.text}\n  Resposta: ${a.value || "(vazio)"}`;
    })
    .join("\n");
  const stripped = prompt
    .split(/\r?\n/)
    .filter((l) => !YESNO_REGEX.test(l) && !/\{\{\s*pergunta\s*:/i.test(l))
    .join("\n");
  return `${stripped}\n\n=== RESPOSTAS DO USU\u00c1RIO ===\n${summary}\n=== FIM DAS RESPOSTAS ===\n\nIMPORTANTE: Use as respostas acima como dados confirmados pelo usu\u00e1rio. N\u00c3O repita as perguntas no documento \u2014 incorpore as respostas naturalmente no conte\u00fado gerado.`;
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
  const [aiProviders, setAiProviders]               = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [apiKey, setApiKey]                         = useState("");
  const [outputFormat, setOutputFormat]             = useState<OutputFormat>("docx");
  const [sqlFiles, setSqlFiles]                     = useState<File[]>([]);
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

  // Carregar provedores de IA ativos
  useEffect(() => {
    listAIProviders({ onlyActive: true })
      .then((list) => {
        const merged = [
          ...list,
          ...INLINE_AI_PROVIDERS.filter((inline) => !list.some((p) => p.provider_type === inline.provider_type && !p.has_key)),
        ];
        setAiProviders(merged);
        if (merged.length > 0) {
          const recommended = merged.find((p) => p.is_recommended) ?? merged[0];
          setSelectedProviderId((cur) => cur || recommended.id);
        }
      })
      .catch(() => {});
  }, []);

  // Recarregar hist\u00f3rico quando sprint muda
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

  const selectedProvider = useMemo(
    () => aiProviders.find((p) => p.id === selectedProviderId) ?? null,
    [aiProviders, selectedProviderId],
  );
  // Modelo híbrido: pede a chave inline quando o provider NÃO é Lovable
  // e ainda não tem chave cadastrada no Vault.
  const providerCfg = useMemo(() => {
    if (!selectedProvider) return { needsKey: false, placeholder: "" };
    const isLovable = selectedProvider.provider_type === "lovable";
    const needsKey = !isLovable && !selectedProvider.has_key;
    const placeholderByType: Record<string, string> = {
      openai: "sk-...",
      gemini: "AIza...",
      anthropic: "sk-ant-...",
      perplexity: "pplx-...",
      lovable: "",
    };
    return { needsKey, placeholder: placeholderByType[selectedProvider.provider_type] ?? "Cole sua API key" };
  }, [selectedProvider]);
  // Limpa apiKey ao trocar de provider
  useEffect(() => { setApiKey(""); }, [selectedProviderId]);
  // Compat com a UI antiga
  const provider: Provider = (selectedProvider?.provider_type ?? "lovable") as Provider;
  const setProvider = (_: Provider) => {};

  useEffect(() => {
    if (!selectedTemplate) { setQuestions([]); setAnswers({}); return; }
    setQuestions(detectInteractiveQuestions(selectedTemplate.prompt_content));
    setAnswers({});
  }, [selectedTemplate]);

  // canGenerate: exige apiKey somente quando o provider escolhido precisa de uma chave inline
  const canGenerate = !!selectedSprintId && !!selectedTemplateId && !!baselineFile
    && huFiles.length > 0 && !!modelFile && !!selectedProviderId
    && (!providerCfg.needsKey || apiKey.trim().length >= 10);

  const allQuestionsAnswered = questions.every((q) => {
    const a = answers[q.id];
    if (!a || !a.value) return false;
    if (q.kind === "yesno" && a.value === "sim" && !a.detail?.trim() && !(q.allowSqlFiles && sqlFiles.length > 0)) return false;
    return true;
  });

  const runGeneration = useCallback(async () => {
    if (!currentTeamId || !user) { toast.error("Sess\u00e3o inv\u00e1lida. Fa\u00e7a login novamente."); return; }

    const missing: string[] = [];
    if (!selectedSprintId)    missing.push("Sprint");
    if (!selectedTemplateId)  missing.push("Template");
    if (!baselineFile)        missing.push("Baseline");
    if (huFiles.length === 0) missing.push("HUs da Sprint");
    if (!modelFile)           missing.push("Modelo de Contagem");
    if (!selectedProviderId)  missing.push("Provedor de IA");
    if (missing.length > 0) { toast.error(`Preencha antes de gerar: ${missing.join(", ")}`); return; }

    setGenerating(true);
    let generationId: string | undefined;

    try {
      const sprint       = sprints.find((s) => s.id === selectedSprintId);
      const baseFilename = `APF_${(sprint?.name ?? "Sprint").replace(/\s+/g, "_")}_${Date.now()}`;
      const filename     = `${baseFilename}.${outputFormat === "docx" ? "docx" : "md"}`;

      // \u2500\u2500 ETAPA 1: Criar registro no banco com status=pending \u2500\u2500
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

      // \u2500\u2500 ETAPA 2: Ler e converter arquivos \u2500\u2500
      setProgressStep("reading_files");
      const allFiles    = [baselineFile!, ...huFiles, modelFile!, ...sqlFiles];
      const filePayload = await prepareFilesForEdgeFunction(allFiles);

      const finalPrompt = applyAnswersToPrompt(
        selectedTemplate!.prompt_content,
        questions,
        answers,
      );

      // \u2500\u2500 ETAPA 3: Chamar a IA \u2500\u2500
      // SEC-005: apiKey n\u00e3o \u00e9 mais passada \u2014 a Edge Function busca no Vault
      setProgressStep("calling_ai");
      const isInlineProvider = selectedProviderId.startsWith("inline:");
      const result = await invokeApfGeneration({
        prompt:       finalPrompt,
        providerId:   isInlineProvider ? undefined : selectedProviderId,
        provider:     isInlineProvider ? selectedProvider?.provider_type : undefined,
        model:        undefined,
        files:        filePayload,
        generationId,
        apiKey:       providerCfg.needsKey ? apiKey.trim() : undefined,
      });

      // \u2500\u2500 ETAPA 4: Finalizar \u2500\u2500
      setProgressStep("saving");
      setLastResult({
        base64:      result.docxBase64,
        markdown:    result.markdown,
        baseFilename,
        pfBreakdown: result.pfBreakdown,
        pfTotal:     result.pfTotal,
      });
      setShowPreview(true);

      const updated = await fetchGenerations(currentTeamId, selectedSprintId);
      setGenerations(updated);

      setProgressStep("done");
      toast.success("Documento gerado! Visualize e baixe no formato desejado.");
    } catch (e: any) {
      console.error("Erro ao gerar APF:", e);
      if (generationId) {
        await (supabase
          .from("apf_generations")
          .update({ status: "error", error_message: e?.message ?? "Erro desconhecido" })
          .eq("id", generationId) as unknown as PromiseLike<unknown>).then(() => {}, () => {});
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
    sprints, outputFormat,
    selectedTemplate, questions, answers,
    selectedProviderId, selectedProvider?.provider_type, apiKey, providerCfg.needsKey, sqlFiles,
  ]);

  const handleGenerateClick = useCallback(() => {
    if (!canGenerate) return;
    if (questions.length > 0 && !allQuestionsAnswered) { setShowQuestions(true); return; }
    void runGeneration();
  }, [canGenerate, allQuestionsAnswered, runGeneration]);

  return {
    sprints,
    selectedSprintId, setSelectedSprintId,
    selectedTemplateId, setSelectedTemplateId,
    templates, selectedTemplate,
    baselineFile, setBaselineFile,
    huFiles, setHuFiles,
    modelFile, setModelFile,
    provider, setProvider, providerCfg,
    aiProviders, selectedProviderId, setSelectedProviderId,
    apiKey, setApiKey,
    outputFormat, setOutputFormat,
    generating, canGenerate,
    progressStep,
    handleGenerateClick, runGeneration,
    generations, loadingHistory,
    lastResult, showPreview, setShowPreview,
    questions, answers, setAnswers,
    sqlFiles, setSqlFiles,
    showQuestions, setShowQuestions,
    allQuestionsAnswered,
  };
}

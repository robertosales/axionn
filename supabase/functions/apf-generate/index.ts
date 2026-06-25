// deno-lint-ignore-file no-explicit-any
/**
 * apf-generate — roteamento dinâmico de providers
 *
 * REFACTOR — Sistema de IA independente (2026-06-23)
 *   - Provider não é mais hard-coded: lido do banco (api_base_url + request_format)
 *   - callGeneric() unifica todos os providers OpenAI-compatible (openai, groq, perplexity,
 *     sakana, lovable, manus, e qualquer novo cadastrado)
 *   - callGemini() e callAnthropic() mantidos por formato próprio
 *   - Type Provider vira string dinâmica — sem mais union de literais
 *   - Adicionar novo provider = apenas cadastrar no admin, zero deploy
 *
 * Histórico anterior em git log.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from "https://esm.sh/docx@8.5.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL   = Deno.env.get("SITE_URL") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, " +
    "x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Provider é agora string dinâmica — vem do banco
type RequestFormat = "openai_compatible" | "gemini" | "anthropic";

interface ProviderRow {
  id: string;
  name: string;
  provider_type: string;
  model: string | null;
  api_base_url: string | null;
  request_format: RequestFormat | null;
  is_active: boolean;
}

interface FileInput {
  name: string;
  content: string;
  encoding?: "base64" | "text";
  mimeType?: string;
}

interface RequestBody {
  prompt: string;
  providerId?: string;
  provider?: string;
  model?: string;
  files?: FileInput[];
  generationId?: string;
  apiKey?: string;
  skipDocx?: boolean;
  testMode?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Resolve provider row + API key
// ─────────────────────────────────────────────────────────────
async function resolveProvider(
  providerId?: string,
  providerLegacy?: string,
  bodyApiKey?: string,
): Promise<{ row: ProviderRow; apiKey: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fallback legado lovable via env
  if (!providerId && providerLegacy === "lovable") {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? null;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada.");
    return {
      row: {
        id: "lovable-legacy",
        name: "Lovable AI (Gemini/GPT) — legado",
        provider_type: "lovable",
        model: "google/gemini-2.5-flash",
        api_base_url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        request_format: "openai_compatible",
        is_active: true,
      },
      apiKey: lovableKey,
    };
  }

  // Chave inline legacy (sem providerId)
  if (!providerId && providerLegacy && bodyApiKey && bodyApiKey.trim().length >= 10) {
    return {
      row: {
        id: "inline-legacy",
        name: `${providerLegacy} — chave temporária`,
        provider_type: providerLegacy,
        model: null,
        api_base_url: null,
        request_format: "openai_compatible",
        is_active: true,
      },
      apiKey: bodyApiKey.trim(),
    };
  }

  let row: ProviderRow | null = null;

  if (providerId) {
    const { data, error } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model,api_base_url,request_format,is_active")
      .eq("id", providerId)
      .maybeSingle();
    if (error || !data) throw new Error("Provedor de IA não encontrado.");
    if (!(data as any).is_active) throw new Error("Este provedor de IA está desativado.");
    row = data as any;
  } else if (providerLegacy) {
    const { data } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model,api_base_url,request_format,is_active")
      .eq("provider_type", providerLegacy)
      .eq("is_active", true)
      .order("is_recommended", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as any) ?? null;
  }

  if (!row) throw new Error("Nenhum provedor de IA selecionado/cadastrado.");

  // Busca API key no vault
  let apiKey: string | null = null;
  const { data: keyData, error: vaultErr } = await admin.rpc("get_ai_provider_key_by_id", { p_id: row.id as any });
  if (vaultErr) {
    console.error(`[VAULT] Falha ao buscar key para provider "${row.name}" (${row.id}):`, vaultErr.message);
  } else if (keyData && typeof keyData === "string" && keyData.trim().length > 0) {
    apiKey = keyData.trim();
  }

  // Fallback env vars por provider_type
  if (!apiKey) {
    const envMap: Record<string, string> = {
      sakana: "SAKANA_API_KEY",
      lovable: "LOVABLE_API_KEY",
      groq: "GROQ_API_KEY",
    };
    const envVar = envMap[row.provider_type];
    if (envVar) {
      const envKey = Deno.env.get(envVar);
      if (envKey && envKey.trim().length >= 10) {
        apiKey = envKey.trim();
        console.log(`[VAULT] Usando ${envVar} do ambiente para provider "${row.name}".`);
      }
    }
  }

  // Fallback chave inline
  if (!apiKey && bodyApiKey && bodyApiKey.trim().length >= 10) {
    apiKey = bodyApiKey.trim();
    console.log(`[VAULT] Usando chave inline para provider "${row.name}".`);
  }

  if (!apiKey) {
    throw new Error(
      `API key não configurada para "${row.name}". Configure a chave no painel administrativo.`,
    );
  }

  return { row, apiKey };
}

// ─────────────────────────────────────────────────────────────
// PARSER 1 — Baseline xlsx
// ─────────────────────────────────────────────────────────────
interface BaselineItem {
  item: string; tipo: string; complexidade: string;
  pfBruto: number | null; pfFs: number | null;
  inm: string | null; impacto: string | null;
}
interface FatorImpacto {
  nome: string; sigla: string; acao: string; contribuicaoFs: number;
}
interface BaselineData {
  pfBrutoTotal: number; itens: BaselineItem[]; fatoresImpacto: FatorImpacto[];
}

function parseBaselineXlsx(base64: string): BaselineData {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const wb = XLSX.read(bytes, { type: "array" });
  const wsItens = wb.Sheets["Itens"];
  const rawItens: any[][] = XLSX.utils.sheet_to_json(wsItens, { header: 1, defval: null });
  let headerRowIdx = 6;
  for (let r = 0; r < rawItens.length; r++) {
    if (String(rawItens[r][0] ?? "").toLowerCase() === "item") { headerRowIdx = r; break; }
  }
  const headerRow = rawItens[headerRowIdx] as string[];
  const col = (name: string) =>
    headerRow.findIndex((h: string) => String(h ?? "").toLowerCase().includes(name.toLowerCase()));
  const iItem = col("item"), iTipo = col("tipo"), iInm = col("inm"), iImpacto = col("impacto");
  const iComplex = col("complex"), iPfBruto = col("pf bruto"), iPfFs = col("pf fs");
  const TIPOS_VALIDOS = new Set(["ALI", "AIE", "SE", "CE", "EE"]);
  const itens: BaselineItem[] = [];
  for (let r = headerRowIdx + 1; r < rawItens.length; r++) {
    const row = rawItens[r];
    const tipo = String(row[iTipo] ?? "").trim().toUpperCase();
    const item = String(row[iItem] ?? "").trim();
    if (!item || !TIPOS_VALIDOS.has(tipo)) continue;
    itens.push({
      item, tipo,
      complexidade: String(row[iComplex] ?? "").trim(),
      pfBruto: row[iPfBruto] != null ? Number(row[iPfBruto]) : null,
      pfFs: row[iPfFs] != null ? Number(row[iPfFs]) : null,
      inm: row[iInm] != null ? String(row[iInm]).trim() : null,
      impacto: row[iImpacto] != null ? String(row[iImpacto]).trim() : null,
    });
  }
  const pfBrutoTotal = itens.reduce((s, i) => s + (i.pfBruto ?? 0), 0);
  const wsFi = wb.Sheets["Fator Impacto"];
  const rawFi: any[][] = XLSX.utils.sheet_to_json(wsFi, { header: 1, defval: null });
  let fiHeaderIdx = 1;
  for (let r = 0; r < rawFi.length; r++) {
    if (String(rawFi[r][0] ?? "").toLowerCase() === "nome") { fiHeaderIdx = r; break; }
  }
  const fiHeader = rawFi[fiHeaderIdx] as string[];
  const fCol = (name: string) =>
    fiHeader.findIndex((h: string) => String(h ?? "").toLowerCase().includes(name.toLowerCase()));
  const iNome = fCol("nome"), iSigla = fCol("sigla");
  const iAcao = fCol("ação") !== -1 ? fCol("ação") : fCol("acao");
  const iContrib = fCol("contribui");
  const fatoresImpacto: FatorImpacto[] = [];
  for (let r = fiHeaderIdx + 1; r < rawFi.length; r++) {
    const row = rawFi[r];
    const nome = String(row[iNome] ?? "").trim();
    if (!nome) continue;
    fatoresImpacto.push({
      nome, sigla: String(row[iSigla] ?? "").trim(),
      acao: String(row[iAcao] ?? "").trim(),
      contribuicaoFs: Number(row[iContrib] ?? 0),
    });
  }
  return { pfBrutoTotal, itens, fatoresImpacto };
}

async function parseDocxToText(base64: string): Promise<string> {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
    const zip = await JSZip.loadAsync(bytes);
    const xmlFile = zip.file("word/document.xml");
    if (!xmlFile) return "[Não foi possível extrair o conteúdo do .docx]";
    const xmlText = await xmlFile.async("text");
    return xmlText
      .replace(/<w:br[^/]*/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:tc>/g, " | ").replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } catch (e: any) {
    return `[Erro ao extrair docx: ${e?.message}]`;
  }
}

async function extractFileContent(file: FileInput): Promise<{ name: string; content: string; isBaseline: boolean }> {
  const nameLower = file.name.toLowerCase();
  const isXlsx = nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls");
  const isDocx = nameLower.endsWith(".docx") || nameLower.endsWith(".doc");
  const isBaseline = isXlsx && (nameLower.includes("baseline") || nameLower.includes("apf"));
  const isBase64 = file.encoding === "base64" || isXlsx || isDocx;
  if (isXlsx && isBase64) {
    try {
      const data = parseBaselineXlsx(file.content);
      const summary = [
        `=== BASELINE APF — ${file.name} ===`,
        `PF Bruto Total do Baseline: ${data.pfBrutoTotal}`,
        `Total de itens: ${data.itens.length}`, ``,
        `--- ITENS DO BASELINE ---`,
        `Item | Tipo | Complexidade | PF Bruto | PF FS`,
        ...data.itens.map((i) => `${i.item} | ${i.tipo} | ${i.complexidade} | ${i.pfBruto ?? ""} | ${i.pfFs ?? ""}`),
        ``, `--- FATORES DE IMPACTO ---`,
        `Sigla | Nome | Contribuição FS`,
        ...data.fatoresImpacto.map((f) => `${f.sigla} | ${f.nome} | ${f.contribuicaoFs}`),
      ].join("\n");
      return { name: file.name, content: summary, isBaseline: true };
    } catch (_e) {
      return { name: file.name, content: `[Erro ao processar baseline xlsx: ${_e}]`, isBaseline: false };
    }
  }
  if (isDocx && isBase64) {
    const text = await parseDocxToText(file.content);
    return { name: file.name, content: `=== MODELO DE DOCUMENTO — ${file.name} ===\n${text}`, isBaseline: false };
  }
  return { name: file.name, content: file.content, isBaseline: false };
}

function extractPfBreakdown(markdown: string): Record<string, number> {
  const breakdown: Record<string, number> = {};
  const lines = markdown.split("\n");
  let inBreakdown = false, totalPf = 0;
  for (const line of lines) {
    if (/consolidado|por hu|7\.2/i.test(line)) { inBreakdown = true; continue; }
    if (inBreakdown && line.trim().startsWith("|")) {
      if (/hu.*pf|pf bruto|pf fs/i.test(line)) continue;
      if (/^\s*\|\s*[-:]+/.test(line)) continue;
      const cols = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      if (cols.length >= 2) {
        const hu = cols[0];
        for (let c = 1; c < cols.length; c++) {
          const num = parseInt(cols[c].replace(/[^0-9]/g, ""), 10);
          if (!isNaN(num) && num > 0 && num < 1000) { breakdown[hu] = num; totalPf += num; break; }
        }
      }
    }
    if (inBreakdown && /^# /.test(line)) inBreakdown = false;
  }
  if (totalPf > 0) breakdown["__total"] = totalPf;
  return breakdown;
}

async function persistResult(opts: {
  generationId: string; markdown: string;
  pfBreakdown: Record<string, number>; docxBase64: string; outputFilename: string;
}) {
  const { generationId, markdown, pfBreakdown, docxBase64, outputFilename } = opts;
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  let storagePath: string | null = null;
  try {
    const docxBytes = Uint8Array.from(atob(docxBase64), (c) => c.charCodeAt(0));
    const { error: storageErr } = await adminClient.storage
      .from("apf-documents")
      .upload(`${generationId}/${outputFilename}`, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (!storageErr) storagePath = `${generationId}/${outputFilename}`;
  } catch (_e) { /* Storage falhou — não bloqueia */ }

  const pfTotal = pfBreakdown["__total"] ??
    Object.entries(pfBreakdown).filter(([k]) => k !== "__total").reduce((s, [, v]) => s + v, 0);

  await adminClient.from("apf_generations").update({
    status: "success", output_markdown: markdown,
    pf_total: pfTotal > 0 ? pfTotal : null,
    pf_breakdown: Object.keys(pfBreakdown).length > 0 ? pfBreakdown : null,
    storage_path: storagePath, output_filename: outputFilename,
  }).eq("id", generationId);
}

function buildFullPrompt(prompt: string, processedFiles: { name: string; content: string }[] = []) {
  const ctx = processedFiles.length > 0
    ? `\n\n=== ARQUIVOS DE CONTEXTO ===\n${processedFiles.map((f) => `--- ${f.name} ---\n${f.content}`).join("\n\n")}\n=== FIM DOS ARQUIVOS ===\n`
    : "";
  return `Você é um especialista em Análise de Pontos de Função (APF) seguindo a metodologia IFPUG e o Guia de Métricas DPF.\n\nSiga estritamente as instruções abaixo. A resposta deve ser apenas o conteúdo do documento, em texto puro.\n\nREGRA — BASELINE:\n- Se um arquivo de BASELINE APF foi fornecido, use a lista de itens para classificar cada funcionalidade:\n  - Impacto "I" (Inclusão) = funcionalidade NÃO existe no baseline\n  - Impacto "A" (Alteração) = funcionalidade JÁ EXISTE no baseline\n  - Impacto "E" (Exclusão) = funcionalidade foi removida\n- Calcule PF FS = PF Bruto × Contribuição FS do fator de impacto aplicado\n\nREGRA — FORMATO DO DOCUMENTO:\n- Use o modelo de documento fornecido como referência de estrutura e seções\n- Mantenha as mesmas seções numeradas: 1. Dados do Atendimento, 2. Contexto, 3. Tabela de Funcionalidades, 4. Funcionalidades Impactadas na Baseline, 5. Itens Não Identificados, 6. Banco de Dados, 7. Contagem de PF (7.1 Detalhamento, 7.2 Consolidado por HU, 7.3 Resumo Executivo), 8. Solicitação de Mudança, 9. Legenda\n- SEMPRE gere a seção 7.2 com a tabela: | HU / Escopo | Qtd. Funções | PF Bruto | PF FS |\n\nREGRA — TABELAS:\n- Use formato Markdown padrão com pipes e linha separadora\n- NÃO inclua tabela dentro de bloco de código\n\nREGRA CRÍTICA — PERGUNTAS NO PROMPT:\n- NÃO inclua perguntas literais no documento gerado\n- Se houver "=== RESPOSTAS DO USUÁRIO ===", incorpore as respostas naturalmente ao texto\n${ctx}\n=== INSTRUÇÕES DO USUÁRIO ===\n${prompt}`;
}

// ─────────────────────────────────────────────────────────────
// Chamadas de IA — dinâmicas por request_format
// ─────────────────────────────────────────────────────────────

class ProviderError extends Error {
  status: number; providerName: string;
  constructor(providerName: string, status: number, message: string) {
    super(`${providerName} [${status}]: ${message}`);
    this.status = status; this.providerName = providerName;
  }
}

/** Chamada genérica para qualquer provider OpenAI-compatible */
async function callGeneric(
  providerName: string,
  apiBaseUrl: string,
  prompt: string,
  apiKey: string,
  model: string,
  extraBody?: Record<string, unknown>,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    ...extraBody,
  };
  const r = await fetch(apiBaseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new ProviderError(providerName, r.status, await r.text());
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`${providerName} retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`);
  return text;
}

async function callGemini(prompt: string, apiKey: string, model = "gemini-2.0-flash"): Promise<string> {
  if (model.startsWith("google/")) model = model.replace("google/", "");
  if (/^gemini-1\.5-(flash|pro)(-latest)?$/i.test(model)) model = "gemini-2.0-flash";
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) },
  );
  const data = await r.json();
  if (!r.ok || data.error) {
    const errMsg = data.error?.message ?? data.error ?? `HTTP ${r.status}`;
    throw new ProviderError("Gemini", r.status || 500, String(errMsg));
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason ?? "sem candidatos";
    throw new Error(`Gemini retornou conteúdo vazio (motivo: ${reason}). Verifique o modelo "${model}" e a chave.`);
  }
  return text;
}

async function callAnthropic(prompt: string, apiKey: string, model = "claude-3-5-sonnet-20241022"): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new ProviderError("Anthropic", r.status, await r.text());
  const data = await r.json();
  const text = data.content?.[0]?.text ?? "";
  if (!text) throw new Error(`Anthropic retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`);
  return text;
}

/** Dispatcher dinâmico — usa dados do banco, sem switch hard-coded */
async function callProvider(row: ProviderRow, prompt: string, apiKey: string, modelOverride?: string): Promise<string> {
  const model = modelOverride ?? row.model ?? "";
  const format = row.request_format ?? "openai_compatible";

  if (format === "gemini") {
    return await callGemini(prompt, apiKey, model || "gemini-2.0-flash");
  }

  if (format === "anthropic") {
    return await callAnthropic(prompt, apiKey, model || "claude-3-5-sonnet-20241022");
  }

  // openai_compatible — usa api_base_url do banco
  const baseUrl = row.api_base_url;
  if (!baseUrl) throw new Error(`Provider "${row.name}" sem api_base_url configurada.`);

  const defaultModels: Record<string, string> = {
    openai: "gpt-4o-mini",
    lovable: "google/gemini-2.5-flash",
    perplexity: "sonar",
    sakana: "fugu",
    groq: "llama-3.3-70b-versatile",
  };
  const finalModel = model || defaultModels[row.provider_type] || "";
  if (!finalModel) throw new Error(`Provider "${row.name}" sem modelo configurado.`);

  // Extra body por provider (ex: sakana exige reasoning)
  const extraBody = row.provider_type === "sakana" ? { reasoning: { effort: "high" } } : undefined;

  return await callGeneric(row.name, baseUrl, prompt, apiKey, finalModel, extraBody);
}

async function listActiveProvidersForFallback(excludeId?: string): Promise<ProviderRow[]> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model,api_base_url,request_format,is_active")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("name");
  const list = (data ?? []) as ProviderRow[];
  return excludeId ? list.filter((p) => p.id !== excludeId) : list;
}

async function getProviderKey(row: ProviderRow): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin.rpc("get_ai_provider_key_by_id", { p_id: row.id });
  let key = (data as string) ?? null;
  if (!key && row.provider_type === "lovable") key = Deno.env.get("LOVABLE_API_KEY") ?? null;
  if (!key && row.provider_type === "sakana")  key = Deno.env.get("SAKANA_API_KEY")  ?? null;
  if (!key && row.provider_type === "groq")    key = Deno.env.get("GROQ_API_KEY")    ?? null;
  return key;
}

function isFallbackableStatus(status: number): boolean {
  return status === 402 || status === 404 || status === 429 || (status >= 500 && status < 600);
}

function mapErrorToReason(err: unknown): { reason: string; userMessage: string; status: number } {
  if (err instanceof ProviderError) {
    if (err.status === 402) return { reason: "AI_PROVIDER_PAYMENT_REQUIRED", status: 402,
      userMessage: "O serviço de IA está sem créditos. Tente outro provedor." };
    if (err.status === 429) return { reason: "AI_PROVIDER_RATE_LIMITED", status: 429,
      userMessage: "Muitas requisições em sequência. Aguarde e tente novamente." };
    if (err.status === 404) return { reason: "AI_PROVIDER_MODEL_NOT_FOUND", status: 404,
      userMessage: `Modelo não encontrado para "${err.providerName}". Tente outro provedor.` };
    if (err.status === 401 || err.status === 403) return { reason: "AI_PROVIDER_AUTH", status: err.status,
      userMessage: `Chave de API inválida para "${err.providerName}". Contate o administrador.` };
    if (err.status >= 500) return { reason: "AI_PROVIDER_UNAVAILABLE", status: err.status,
      userMessage: `O serviço "${err.providerName}" está temporariamente indisponível.` };
  }
  return { reason: "AI_PROVIDER_ERROR", status: 500,
    userMessage: "Não foi possível gerar o documento agora. Tente novamente." };
}

// ─────────────────────────────────────────────────────────────
// DOCX builder (inalterado)
// ─────────────────────────────────────────────────────────────
const HEADER_FILL = "1F4E78", KEY_FILL = "D9D9D9", BORDER_COLOR = "9DB2BF";
const cellBorder = { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR };
const cbs = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function makeCell(text: string, opts: { header?: boolean; keyCol?: boolean; width: number } = { width: 4680 }): TableCell {
  const isBold = !!opts.header || !!opts.keyCol;
  const fill = opts.header ? HEADER_FILL : opts.keyCol ? KEY_FILL : undefined;
  const color = opts.header ? "FFFFFF" : "000000";
  return new TableCell({
    borders: cbs,
    width: { size: opts.width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: text || "", bold: isBold, color, size: 20 })] })],
  });
}

function parseMarkdownRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}
function buildDocxTable(headerCells: string[], rows: string[][]): Table {
  const TOTAL_WIDTH = 9360;
  const colCount = Math.max(headerCells.length, ...rows.map((r) => r.length), 1);
  const colWidth = Math.floor(TOTAL_WIDTH / colCount);
  const isKeyValue = colCount === 2 && headerCells.every((h) => !h || /^(campo|chave|item|atributo)$/i.test(h));
  const trs: TableRow[] = [];
  if (!isKeyValue) {
    trs.push(new TableRow({ tableHeader: true,
      children: headerCells.concat(Array(colCount - headerCells.length).fill(""))
        .map((h) => makeCell(h, { header: true, width: colWidth })) }));
  }
  for (const r of rows) {
    const padded = r.concat(Array(colCount - r.length).fill(""));
    trs.push(new TableRow({ children: padded.map((cellText, idx) =>
      makeCell(cellText, { keyCol: isKeyValue && idx === 0, width: colWidth })) }));
  }
  return new Table({
    width: { size: TOTAL_WIDTH, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth), rows: trs,
  });
}
function textToDocxBlocks(text: string): (Paragraph | Table)[] {
  const lines = text.split(/\r?\n/), blocks: (Paragraph | Table)[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (line.trim().startsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = parseMarkdownRow(line); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(parseMarkdownRow(lines[i])); i++; }
      blocks.push(buildDocxTable(header, rows));
      blocks.push(new Paragraph({ children: [new TextRun("")] })); continue;
    }
    if (!line.trim()) { blocks.push(new Paragraph({ children: [new TextRun("")] })); }
    else if (line.startsWith("# ")) {
      blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line.slice(2), bold: true, size: 32 })], spacing: { before: 240, after: 160 } }));
    } else if (line.startsWith("## ")) {
      blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.slice(3), bold: true, size: 28 })], spacing: { before: 200, after: 120 } }));
    } else if (line.startsWith("### ")) {
      blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: line.slice(4), bold: true, size: 24 })], spacing: { before: 160, after: 100 } }));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push(new Paragraph({ children: [new TextRun(line.slice(2))], bullet: { level: 0 } }));
    } else {
      blocks.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun(line)], spacing: { after: 120 } }));
    }
    i++;
  }
  return blocks;
}
async function generateDocxBase64(text: string): Promise<string> {
  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: textToDocxBlocks(text) }],
  });
  const buffer = await Packer.toBuffer(doc);
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  return btoa(binary);
}

// ─────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.slice(7);
    const isServiceRole = SERVICE_KEY && token === SERVICE_KEY;

    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { prompt, provider, providerId, model, files, generationId, testMode } = body;

    if (!testMode && !prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!providerId && !provider) {
      return new Response(JSON.stringify({ error: "providerId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (providerId && !UUID_REGEX.test(providerId)) {
      return new Response(JSON.stringify({ error: "providerId deve ser um UUID válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (generationId && !UUID_REGEX.test(generationId)) {
      return new Response(JSON.stringify({ error: "generationId deve ser um UUID válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { row: resolved, apiKey } = await resolveProvider(providerId, provider, body.apiKey);

    // Modo teste
    if (testMode) {
      const t0 = Date.now();
      try {
        const sample = await callProvider(resolved, "Responda apenas com a palavra: OK", apiKey, model);
        return new Response(JSON.stringify({
          success: true, providerUsed: resolved.name, providerType: resolved.provider_type,
          model: resolved.model, latencyMs: Date.now() - t0, sample: (sample || "").slice(0, 200),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 500;
        const { reason, userMessage } = mapErrorToReason(e);
        return new Response(JSON.stringify({
          success: false, testMode: true, providerUsed: resolved.name,
          providerType: resolved.provider_type, status, reason, userMessage,
          rawError: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - t0,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const processedFiles: { name: string; content: string }[] = [];
    for (const file of files ?? []) {
      const extracted = await extractFileContent(file);
      processedFiles.push({ name: extracted.name, content: extracted.content });
    }

    const fullPrompt = buildFullPrompt(prompt!, processedFiles);

    let aiText = "";
    let usedProviderName = resolved.name;
    let fallbackInfo: { from: string; to: string; reason: string } | null = null;
    const attempts: Array<{ name: string; status?: number; error: string }> = [];

    try {
      aiText = await callProvider(resolved, fullPrompt, apiKey, model);
    } catch (primaryErr) {
      const primaryStatus = primaryErr instanceof ProviderError ? primaryErr.status : 500;
      attempts.push({ name: resolved.name, status: primaryStatus,
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr) });
      console.warn(`[apf-generate] Primary "${resolved.name}" failed (${primaryStatus}). Trying fallback...`);

      if (!isFallbackableStatus(primaryStatus)) throw primaryErr;

      const candidates = await listActiveProvidersForFallback(providerId);
      let succeeded = false;
      for (const cand of candidates) {
        try {
          const candKey = await getProviderKey(cand);
          if (!candKey) { attempts.push({ name: cand.name, error: "Sem API key configurada" }); continue; }
          aiText = await callProvider(cand, fullPrompt, candKey, cand.model ?? undefined);
          usedProviderName = cand.name;
          fallbackInfo = { from: resolved.name, to: cand.name,
            reason: primaryStatus === 402 ? "sem créditos" : `falha HTTP ${primaryStatus}` };
          succeeded = true;
          console.log(`[apf-generate] Fallback: ${resolved.name} → ${cand.name}`);
          break;
        } catch (fallErr) {
          const fallStatus = fallErr instanceof ProviderError ? fallErr.status : 500;
          attempts.push({ name: cand.name, status: fallStatus,
            error: fallErr instanceof Error ? fallErr.message : String(fallErr) });
          console.warn(`[apf-generate] Fallback "${cand.name}" failed (${fallStatus}).`);
        }
      }

      if (!succeeded) {
        const { reason, userMessage } = mapErrorToReason(primaryErr);
        if (generationId) {
          const admin = createClient(SUPABASE_URL, SERVICE_KEY);
          await admin.from("apf_generations").update({ status: "error", error_message: userMessage }).eq("id", generationId);
        }
        return new Response(JSON.stringify({ success: false, reason, userMessage, attempts }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!aiText.trim()) throw new Error("A IA retornou conteúdo vazio");

    const docxBase64 = body.skipDocx ? "" : await generateDocxBase64(aiText);
    const pfBreakdown = extractPfBreakdown(aiText);
    const pfTotal = pfBreakdown["__total"] ?? null;
    const outputFilename = `Evidencia_APF_${new Date().toISOString().slice(0, 10)}.docx`;

    if (generationId) {
      await persistResult({ generationId, markdown: aiText, pfBreakdown, docxBase64, outputFilename });
    }

    return new Response(JSON.stringify({
      success: true, docxBase64, markdown: aiText, charCount: aiText.length,
      pfBreakdown, pfTotal, outputFilename, providerUsed: usedProviderName, fallback: fallbackInfo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    console.error("apf-generate error:", e);
    const raw = e instanceof Error ? e.message : "Erro desconhecido";
    let friendly = raw;
    if (/credit balance is too low/i.test(raw)) friendly = "Conta sem créditos. Contate o administrador.";
    else if (/invalid.*api.key|incorrect api key/i.test(raw)) friendly = "Chave de API inválida. Contate o administrador.";
    else if (/401/i.test(raw)) friendly = "Chave de API recusada (401). Verifique a chave no Vault.";
    else if (/rate limit|429/i.test(raw)) friendly = "Limite de requisições atingido. Aguarde e tente novamente.";
    else if (/não configurada/i.test(raw)) friendly = raw;
    const { reason, userMessage, status } = mapErrorToReason(e);
    const httpStatus = isFallbackableStatus(status) ? 200 : status >= 400 && status < 600 ? status : 500;
    return new Response(JSON.stringify({ success: false, reason, userMessage: friendly !== raw ? friendly : userMessage, rawError: raw }),
      { status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

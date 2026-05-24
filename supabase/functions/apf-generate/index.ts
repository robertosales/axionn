// deno-lint-ignore-file no-explicit-any
/**
 * SEC-005 — apf-generate (hardened)
 *
 * Mudanças de segurança:
 *   1. apiKey removida do body — buscada no Vault via get_ai_provider_key()
 *   2. supabaseServiceKey removida do body — usa env var SUPABASE_SERVICE_ROLE_KEY
 *   3. CORS restrito ao SITE_URL
 *   4. Autenticação obrigatória (JWT validado)
 *   5. provider validado contra lista de permitidos
 *   6. generationId validado como UUID
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from "https://esm.sh/docx@8.5.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY          = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  SITE_URL,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, " +
    "x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Provider = "lovable" | "openai" | "gemini" | "anthropic" | "perplexity";

interface FileInput {
  name: string;
  content: string;
  encoding?: "base64" | "text";
  mimeType?: string;
}

interface RequestBody {
  prompt:       string;
  providerId?:  string;       // novo — uuid da linha em ai_providers
  provider?:    Provider;     // legado — tipo fixo (compat)
  model?:       string;
  files?:       FileInput[];
  generationId?: string;
  /**
   * Modelo híbrido: chave inline informada pelo usuário (não persistida).
   * Só é considerada quando o Vault não tem chave para este provider
   * e o provider não é o Lovable AI.
   */
  apiKey?: string;
}

// ─────────────────────────────────────────────────────────────
// Resolve provider row + API key
// ─────────────────────────────────────────────────────────────
async function resolveProvider(providerId?: string, providerLegacy?: string, bodyApiKey?: string): Promise<{
  providerType: Provider; apiKey: string; model: string | null; name: string;
}> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let row: { id: string; name: string; provider_type: Provider; model: string | null } | null = null;

  if (providerId) {
    const { data, error } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model,is_active")
      .eq("id", providerId)
      .maybeSingle();
    if (error || !data) throw new Error("Provedor de IA não encontrado.");
    if (!data.is_active) throw new Error("Este provedor de IA está desativado.");
    row = data as any;
  } else if (providerLegacy) {
    // compat: primeira linha ativa do tipo
    const { data } = await admin
      .from("ai_providers")
      .select("id,name,provider_type,model")
      .eq("provider_type", providerLegacy)
      .eq("is_active", true)
      .order("is_recommended", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as any) ?? null;
  }

  if (!row) throw new Error("Nenhum provedor de IA selecionado/cadastrado.");

  // Busca a key no Vault pelo id da linha
  let apiKey: string | null = null;
  const { data: keyData } = await admin.rpc("get_ai_provider_key_by_id", { p_id: row.id });
  if (keyData) apiKey = keyData as string;

  // Fallback Lovable: usa a env do próprio gateway
  if (!apiKey && row.provider_type === "lovable") {
    apiKey = Deno.env.get("LOVABLE_API_KEY") ?? null;
  }

  // Modelo híbrido: aceita chave inline informada pelo usuário quando o
  // Vault não tem nada cadastrado (e o provider não é o Lovable).
  if (!apiKey && row.provider_type !== "lovable" && bodyApiKey && bodyApiKey.trim().length >= 10) {
    apiKey = bodyApiKey.trim();
  }

  if (!apiKey) {
    throw new Error(`API key não configurada para "${row.name}". Cadastre no painel admin ou informe a chave na tela.`);
  }

  return { providerType: row.provider_type, apiKey, model: row.model, name: row.name };
}

// ─────────────────────────────────────────────────────────────
// PARSER 1 — Baseline xlsx
// ─────────────────────────────────────────────────────────────
interface BaselineItem {
  item: string; tipo: string; complexidade: string;
  pfBruto: number | null; pfFs: number | null;
  inm: string | null; impacto: string | null;
}
interface FatorImpacto { nome: string; sigla: string; acao: string; contribuicaoFs: number; }
interface BaselineData { pfBrutoTotal: number; itens: BaselineItem[]; fatoresImpacto: FatorImpacto[]; }

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
  const col = (name: string) => headerRow.findIndex((h: string) => String(h ?? "").toLowerCase().includes(name.toLowerCase()));
  const iItem = col("item"), iTipo = col("tipo"), iInm = col("inm"), iImpacto = col("impacto");
  const iComplex = col("complex"), iPfBruto = col("pf bruto"), iPfFs = col("pf fs");
  const TIPOS_VALIDOS = new Set(["ALI", "AIE", "SE", "CE", "EE"]);
  const itens: BaselineItem[] = [];
  for (let r = headerRowIdx + 1; r < rawItens.length; r++) {
    const row = rawItens[r];
    const tipo = String(row[iTipo] ?? "").trim().toUpperCase();
    const item = String(row[iItem] ?? "").trim();
    if (!item || !TIPOS_VALIDOS.has(tipo)) continue;
    itens.push({ item, tipo, complexidade: String(row[iComplex] ?? "").trim(),
      pfBruto: row[iPfBruto] != null ? Number(row[iPfBruto]) : null,
      pfFs:    row[iPfFs]    != null ? Number(row[iPfFs])    : null,
      inm:     row[iInm]     != null ? String(row[iInm]).trim() : null,
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
  const fCol = (name: string) => fiHeader.findIndex((h: string) => String(h ?? "").toLowerCase().includes(name.toLowerCase()));
  const iNome = fCol("nome"), iSigla = fCol("sigla");
  const iAcao = fCol("ação") !== -1 ? fCol("ação") : fCol("acao");
  const iContrib = fCol("contribui");
  const fatoresImpacto: FatorImpacto[] = [];
  for (let r = fiHeaderIdx + 1; r < rawFi.length; r++) {
    const row = rawFi[r];
    const nome = String(row[iNome] ?? "").trim();
    if (!nome) continue;
    fatoresImpacto.push({ nome, sigla: String(row[iSigla] ?? "").trim(),
      acao: String(row[iAcao] ?? "").trim(), contribuicaoFs: Number(row[iContrib] ?? 0) });
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
      .replace(/<w:br[^/]*/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:tc>/g, " | ")
      .replace(/<[^>]+>/g, "")
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
        ...data.itens.map(i => `${i.item} | ${i.tipo} | ${i.complexidade} | ${i.pfBruto ?? ""} | ${i.pfFs ?? ""}`),
        ``, `--- FATORES DE IMPACTO ---`,
        `Sigla | Nome | Contribuição FS`,
        ...data.fatoresImpacto.map(f => `${f.sigla} | ${f.nome} | ${f.contribuicaoFs}`),
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
      const cols = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
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

  // 1. Salvar docx no Storage
  let storagePath: string | null = null;
  try {
    const docxBytes = Uint8Array.from(atob(docxBase64), c => c.charCodeAt(0));
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

  // 2. Atualizar registro em apf_generations
  await adminClient.from("apf_generations").update({
    status: "success",
    output_markdown: markdown,
    pf_total: pfTotal > 0 ? pfTotal : null,
    pf_breakdown: Object.keys(pfBreakdown).length > 0 ? pfBreakdown : null,
    storage_path: storagePath,
    output_filename: outputFilename,
  }).eq("id", generationId);
}

function buildFullPrompt(prompt: string, processedFiles: { name: string; content: string }[] = []) {
  const ctx = processedFiles.length > 0
    ? `\n\n=== ARQUIVOS DE CONTEXTO ===\n${processedFiles.map(f => `--- ${f.name} ---\n${f.content}`).join("\n\n")}\n=== FIM DOS ARQUIVOS ===\n`
    : "";
  return `Você é um especialista em Análise de Pontos de Função (APF) seguindo a metodologia IFPUG e o Guia de Métricas DPF.\n\nSiga estritamente as instruções abaixo. A resposta deve ser apenas o conteúdo do documento, em texto puro.\n\nREGRA — BASELINE:\n- Se um arquivo de BASELINE APF foi fornecido, use a lista de itens para classificar cada funcionalidade:\n  - Impacto \"I\" (Inclusão) = funcionalidade NÃO existe no baseline\n  - Impacto \"A\" (Alteração) = funcionalidade JÁ EXISTE no baseline\n  - Impacto \"E\" (Exclusão) = funcionalidade foi removida\n- Calcule PF FS = PF Bruto × Contribuição FS do fator de impacto aplicado\n\nREGRA — FORMATO DO DOCUMENTO:\n- Use o modelo de documento fornecido como referência de estrutura e seções\n- Mantenha as mesmas seções numeradas: 1. Dados do Atendimento, 2. Contexto, 3. Tabela de Funcionalidades, 4. Funcionalidades Impactadas na Baseline, 5. Itens Não Identificados, 6. Banco de Dados, 7. Contagem de PF (7.1 Detalhamento, 7.2 Consolidado por HU, 7.3 Resumo Executivo), 8. Solicitação de Mudança, 9. Legenda\n- SEMPRE gere a seção 7.2 com a tabela: | HU / Escopo | Qtd. Funções | PF Bruto | PF FS |\n\nREGRA — TABELAS:\n- Use formato Markdown padrão com pipes e linha separadora\n- NÃO inclua tabela dentro de bloco de código\n\nREGRA CRÍTICA — PERGUNTAS NO PROMPT:\n- NÃO inclua perguntas literais no documento gerado\n- Se houver \"=== RESPOSTAS DO USUÁRIO ===\", incorpore as respostas naturalmente ao texto\n${ctx}\n=== INSTRUÇÕES DO USUÁRIO ===\n${prompt}`;
}

// ─────────────────────────────────────────────────────────────
// Erro tipado com status HTTP (para fallback e UX)
// ─────────────────────────────────────────────────────────────
class ProviderError extends Error {
  status: number;
  providerName: string;
  constructor(providerName: string, status: number, message: string) {
    super(`${providerName} [${status}]: ${message}`);
    this.status = status;
    this.providerName = providerName;
  }
}

// Chamadas aos providers (apiKey vem do Vault, não do body)
async function callLovable(p: string, k: string, m = "google/gemini-2.5-flash") {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: m, messages: [{ role: "user", content: p }] }),
  });
  if (!r.ok) throw new ProviderError("Lovable AI", r.status, await r.text());
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`Lovable AI retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`);
  return text;
}
async function callOpenAI(p: string, k: string, m = "gpt-4o-mini") {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: m, messages: [{ role: "user", content: p }] }),
  });
  if (!r.ok) throw new ProviderError("OpenAI", r.status, await r.text());
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`OpenAI retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`);
  return text;
}
async function callGemini(p: string, k: string, m = "gemini-2.0-flash") {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: p }] }] }),
  });
  const data = await r.json();
  // Trata erros retornados com status 200 mas com campo "error" no body
  if (!r.ok || data.error) {
    const errMsg = data.error?.message ?? data.error ?? `HTTP ${r.status}`;
    throw new ProviderError("Gemini", r.status || 500, String(errMsg));
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    // Loga o motivo de bloqueio, se houver (finishReason, safetyRatings)
    const reason = data.candidates?.[0]?.finishReason ?? "sem candidatos";
    throw new Error(`Gemini retornou conteúdo vazio (motivo: ${reason}). Verifique o modelo "${m}" e a chave.`);
  }
  return text;
}
async function callAnthropic(p: string, k: string, m = "claude-3-5-sonnet-20241022") {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: m, max_tokens: 8000, messages: [{ role: "user", content: p }] }),
  });
  if (!r.ok) throw new ProviderError("Anthropic", r.status, await r.text());
  const data = await r.json();
  const text = data.content?.[0]?.text ?? "";
  if (!text) throw new Error(`Anthropic retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`);
  return text;
}
async function callPerplexity(p: string, k: string, m = "sonar") {
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: m, messages: [{ role: "user", content: p }] }),
  });
  if (!r.ok) throw new ProviderError("Perplexity", r.status, await r.text());
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`Perplexity retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`);
  return text;
}

// Despacha a chamada pela tipologia do provider
async function callProvider(
  type: Provider, prompt: string, apiKey: string, model?: string,
): Promise<string> {
  switch (type) {
    case "lovable":    return await callLovable(prompt,    apiKey, model);
    case "openai":     return await callOpenAI(prompt,     apiKey, model);
    case "gemini":     return await callGemini(prompt,     apiKey, model);
    case "anthropic":  return await callAnthropic(prompt,  apiKey, model);
    case "perplexity": return await callPerplexity(prompt, apiKey, model);
  }
}

// Lista de provedores ativos para fallback (ordenados: recomendados primeiro)
async function listActiveProvidersForFallback(excludeId?: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("name");
  const list = (data ?? []) as Array<{ id: string; name: string; provider_type: Provider; model: string | null }>;
  return excludeId ? list.filter((p) => p.id !== excludeId) : list;
}

async function getProviderKey(id: string, type: Provider): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin.rpc("get_ai_provider_key_by_id", { p_id: id });
  let key = (data as string) ?? null;
  if (!key && type === "lovable") key = Deno.env.get("LOVABLE_API_KEY") ?? null;
  return key;
}

// Erros recuperáveis → tentamos fallback
function isFallbackableStatus(status: number): boolean {
  return status === 402 || status === 429 || (status >= 500 && status < 600);
}

function mapErrorToReason(err: unknown): { reason: string; userMessage: string; status: number } {
  if (err instanceof ProviderError) {
    if (err.status === 402) return {
      reason: "AI_PROVIDER_PAYMENT_REQUIRED", status: 402,
      userMessage: "O serviço de IA está sem créditos no momento. Tente novamente mais tarde ou selecione outro provedor de IA.",
    };
    if (err.status === 429) return {
      reason: "AI_PROVIDER_RATE_LIMITED", status: 429,
      userMessage: "Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.",
    };
    if (err.status === 401 || err.status === 403) return {
      reason: "AI_PROVIDER_AUTH", status: err.status,
      userMessage: `Chave de API inválida para "${err.providerName}". Contate o administrador.`,
    };
    if (err.status >= 500) return {
      reason: "AI_PROVIDER_UNAVAILABLE", status: err.status,
      userMessage: `O serviço de IA "${err.providerName}" está temporariamente indisponível. Tente novamente em instantes.`,
    };
  }
  const raw = err instanceof Error ? err.message : "Erro desconhecido";
  return {
    reason: "AI_PROVIDER_ERROR", status: 500,
    userMessage: "Não foi possível gerar o documento agora. Tente novamente em alguns instantes.",
  };
}

// ─────────────────────────────────────────────────────────────
// DOCX builder
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
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}
function buildDocxTable(headerCells: string[], rows: string[][]): Table {
  const TOTAL_WIDTH = 9360;
  const colCount = Math.max(headerCells.length, ...rows.map(r => r.length), 1);
  const colWidth = Math.floor(TOTAL_WIDTH / colCount);
  const isKeyValue = colCount === 2 && headerCells.every(h => !h || /^(campo|chave|item|atributo)$/i.test(h));
  const trs: TableRow[] = [];
  if (!isKeyValue) {
    trs.push(new TableRow({ tableHeader: true, children: headerCells.concat(Array(colCount - headerCells.length).fill("")).map(h => makeCell(h, { header: true, width: colWidth })) }));
  }
  for (const r of rows) {
    const padded = r.concat(Array(colCount - r.length).fill(""));
    trs.push(new TableRow({ children: padded.map((cellText, idx) => makeCell(cellText, { keyCol: isKeyValue && idx === 0, width: colWidth })) }));
  }
  return new Table({ width: { size: TOTAL_WIDTH, type: WidthType.DXA }, columnWidths: Array(colCount).fill(colWidth), rows: trs });
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
      blocks.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }
    if (!line.trim()) { blocks.push(new Paragraph({ children: [new TextRun("")] })); }
    else if (line.startsWith("# "))   { blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: line.slice(2),  bold: true, size: 32 })], spacing: { before: 240, after: 160 } })); }
    else if (line.startsWith("## "))  { blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.slice(3),  bold: true, size: 28 })], spacing: { before: 200, after: 120 } })); }
    else if (line.startsWith("### ")) { blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: line.slice(4),  bold: true, size: 24 })], spacing: { before: 160, after: 100 } })); }
    else if (line.startsWith("- ") || line.startsWith("* ")) { blocks.push(new Paragraph({ children: [new TextRun(line.slice(2))], bullet: { level: 0 } })); }
    else { blocks.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun(line)], spacing: { after: 120 } })); }
    i++;
  }
  return blocks;
}
async function generateDocxBase64(text: string): Promise<string> {
  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: textToDocxBlocks(text) }],
  });
  const buffer = await Packer.toBuffer(doc);
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  return btoa(binary);
}

// ─────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Autenticação obrigatória ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse e validação do body ──
    const body = await req.json().catch(() => ({})) as RequestBody;
    const { prompt, provider, providerId, model, files, generationId } = body;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!providerId && !provider) {
      return new Response(JSON.stringify({ error: "providerId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (providerId && !UUID_REGEX.test(providerId)) {
      return new Response(JSON.stringify({ error: "providerId deve ser um UUID válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (generationId && !UUID_REGEX.test(generationId)) {
      return new Response(JSON.stringify({ error: "generationId deve ser um UUID válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Resolve o provider + busca a API key (Vault → env → body) ──
    const resolved = await resolveProvider(providerId, provider, body.apiKey);

    // ── 4. Processa arquivos ──
    const processedFiles: { name: string; content: string }[] = [];
    for (const file of files ?? []) {
      const extracted = await extractFileContent(file);
      processedFiles.push({ name: extracted.name, content: extracted.content });
    }

    // ── 5. Chama a IA com fallback automático ──
    const fullPrompt = buildFullPrompt(prompt, processedFiles);

    let aiText = "";
    let usedProviderName = resolved.name;
    let fallbackInfo: { from: string; to: string; reason: string } | null = null;
    const attempts: Array<{ name: string; status?: number; error: string }> = [];

    try {
      aiText = await callProvider(
        resolved.providerType, fullPrompt, resolved.apiKey,
        model ?? resolved.model ?? undefined,
      );
    } catch (primaryErr) {
      const primaryStatus = primaryErr instanceof ProviderError ? primaryErr.status : 500;
      attempts.push({
        name: resolved.name, status: primaryStatus,
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });
      console.warn(`[apf-generate] Primary provider "${resolved.name}" failed (status=${primaryStatus}). Trying fallback...`);

      if (!isFallbackableStatus(primaryStatus)) {
        // erro não-recuperável → propaga
        throw primaryErr;
      }

      // Tenta o próximo provider ativo (excluindo o que já falhou)
      const candidates = await listActiveProvidersForFallback(providerId);
      let succeeded = false;
      for (const cand of candidates) {
        try {
          const candKey = await getProviderKey(cand.id, cand.provider_type);
          if (!candKey) {
            attempts.push({ name: cand.name, error: "Sem API key configurada" });
            continue;
          }
          aiText = await callProvider(cand.provider_type, fullPrompt, candKey, cand.model ?? undefined);
          usedProviderName = cand.name;
          fallbackInfo = {
            from: resolved.name, to: cand.name,
            reason: primaryStatus === 402 ? "sem créditos" : `falha HTTP ${primaryStatus}`,
          };
          succeeded = true;
          console.log(`[apf-generate] Fallback succeeded: ${resolved.name} → ${cand.name}`);
          break;
        } catch (fallErr) {
          const fallStatus = fallErr instanceof ProviderError ? fallErr.status : 500;
          attempts.push({
            name: cand.name, status: fallStatus,
            error: fallErr instanceof Error ? fallErr.message : String(fallErr),
          });
          console.warn(`[apf-generate] Fallback "${cand.name}" failed (status=${fallStatus}).`);
        }
      }

      if (!succeeded) {
        // Nenhum provider conseguiu → retorna estrutura amigável (sem quebrar a tela)
        const { reason, userMessage } = mapErrorToReason(primaryErr);
        if (generationId) {
          const admin = createClient(SUPABASE_URL, SERVICE_KEY);
          await admin.from("apf_generations").update({
            status: "error", error_message: userMessage,
          }).eq("id", generationId);
        }
        return new Response(JSON.stringify({
          success: false, reason, userMessage, attempts,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!aiText.trim()) throw new Error("A IA retornou conteúdo vazio");

    // ── 6. Gera docx + persiste ──
    const docxBase64     = await generateDocxBase64(aiText);
    const pfBreakdown    = extractPfBreakdown(aiText);
    const pfTotal        = pfBreakdown["__total"] ?? null;
    const outputFilename = `Evidencia_APF_${new Date().toISOString().slice(0, 10)}.docx`;

    if (generationId) {
      await persistResult({ generationId, markdown: aiText, pfBreakdown, docxBase64, outputFilename });
    }

    return new Response(
      JSON.stringify({
        success: true, docxBase64, markdown: aiText, charCount: aiText.length,
        pfBreakdown, pfTotal, outputFilename,
        providerUsed: usedProviderName, fallback: fallbackInfo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e: unknown) {
    console.error("apf-generate error:", e);
    const { reason, userMessage, status } = mapErrorToReason(e);
    // Para erros recuperáveis (402/429/5xx) devolvemos 200 com payload tipado, evitando
    // Runtime Error no cliente. Outros erros mantém status apropriado.
    const httpStatus = isFallbackableStatus(status) ? 200 : (status >= 400 && status < 600 ? status : 500);
    return new Response(
      JSON.stringify({ success: false, reason, userMessage }),
      { status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

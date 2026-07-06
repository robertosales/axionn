// deno-lint-ignore-file no-explicit-any
/**
 * apf-generate — roteamento dinâmico de providers com governança SaaS.
 *
 * Controles aplicados:
 * - autenticação e autorização por time;
 * - licença e quota transacionais;
 * - registro de consumo;
 * - limites de payload;
 * - teste de provider restrito a administradores;
 * - chave inline restrita a chamadas privilegiadas.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from "https://esm.sh/docx@8.5.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const USAGE_MODE = (Deno.env.get("AI_USAGE_ENFORCEMENT_MODE") ?? "audit").toLowerCase();
const MAX_PROMPT_CHARS = Number(Deno.env.get("AI_MAX_PROMPT_CHARS") ?? 120_000);
const MAX_FILES = Number(Deno.env.get("AI_MAX_FILES") ?? 5);
const MAX_FILE_CHARS = Number(Deno.env.get("AI_MAX_FILE_CHARS") ?? 8_000_000);
const MAX_TOTAL_FILE_CHARS = Number(Deno.env.get("AI_MAX_TOTAL_FILE_CHARS") ?? 20_000_000);
const MAX_FALLBACK_PROVIDERS = Number(Deno.env.get("AI_MAX_FALLBACK_PROVIDERS") ?? 2);
const PROVIDER_TIMEOUT_MS = Number(Deno.env.get("AI_PROVIDER_TIMEOUT_MS") ?? 120_000);

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, " +
    "x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  teamId?: string;
  projectId?: string;
  storyId?: string;
  feature?: string;
  apiKey?: string;
  skipDocx?: boolean;
  testMode?: boolean;
}

interface UsageReservation {
  requestId: string;
  data: Record<string, unknown> | null;
}

class UsageError extends Error {
  status: number;
  code: string;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function usageErrorFromMessage(message: string) {
  if (message.includes("AI_QUOTA_EXCEEDED")) {
    return new UsageError(
      "AI_QUOTA_EXCEEDED",
      429,
      "A franquia mensal de IA desta empresa foi atingida.",
    );
  }
  if (message.includes("AI_TEAM_ACCESS_DENIED")) {
    return new UsageError(
      "AI_TEAM_ACCESS_DENIED",
      403,
      "Você não possui acesso ao time informado.",
    );
  }
  if (message.includes("AI_LICENSE_EXPIRED")) {
    return new UsageError(
      "AI_LICENSE_EXPIRED",
      402,
      "A licença da empresa está expirada.",
    );
  }
  if (message.includes("AI_LICENSE_INACTIVE")) {
    return new UsageError(
      "AI_LICENSE_INACTIVE",
      402,
      "A licença da empresa não está ativa.",
    );
  }
  if (message.includes("AI_LICENSE_REQUIRED")) {
    return new UsageError(
      "AI_LICENSE_REQUIRED",
      402,
      "A empresa não possui licença configurada para utilizar IA.",
    );
  }
  if (message.includes("AI_COMPANY_REQUIRED")) {
    return new UsageError(
      "AI_COMPANY_REQUIRED",
      409,
      "O time precisa estar vinculado a uma empresa antes de utilizar IA.",
    );
  }
  if (message.includes("AI_TEAM_NOT_FOUND")) {
    return new UsageError("AI_TEAM_NOT_FOUND", 404, "Time não encontrado.");
  }
  return new UsageError(
    "AI_USAGE_AUTHORIZATION_FAILED",
    503,
    "Não foi possível validar a licença e a quota de IA.",
  );
}

async function isPlatformAdmin(admin: any, userId: string | null) {
  if (!userId) return false;
  const { data, error } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[apf-generate] Falha ao verificar admin:", error.message);
    return false;
  }
  return Boolean(data);
}

function validatePayload(body: RequestBody) {
  const prompt = body.prompt ?? "";
  if (!body.testMode && !prompt.trim()) {
    throw new UsageError("AI_PROMPT_REQUIRED", 400, "Prompt é obrigatório.");
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new UsageError(
      "AI_PROMPT_TOO_LARGE",
      413,
      `O prompt excede o limite de ${MAX_PROMPT_CHARS} caracteres.`,
    );
  }

  const files = body.files ?? [];
  if (files.length > MAX_FILES) {
    throw new UsageError(
      "AI_TOO_MANY_FILES",
      413,
      `Envie no máximo ${MAX_FILES} arquivos por solicitação.`,
    );
  }

  let totalChars = 0;
  for (const file of files) {
    if (!file.name?.trim() || file.name.length > 255) {
      throw new UsageError("AI_FILE_NAME_INVALID", 400, "Nome de arquivo inválido.");
    }
    if (typeof file.content !== "string") {
      throw new UsageError("AI_FILE_CONTENT_INVALID", 400, "Conteúdo de arquivo inválido.");
    }
    if (file.content.length > MAX_FILE_CHARS) {
      throw new UsageError(
        "AI_FILE_TOO_LARGE",
        413,
        `O arquivo ${file.name} excede o limite permitido.`,
      );
    }
    totalChars += file.content.length;
  }

  if (totalChars > MAX_TOTAL_FILE_CHARS) {
    throw new UsageError(
      "AI_FILES_TOO_LARGE",
      413,
      "O conjunto de arquivos excede o limite permitido.",
    );
  }
}

async function resolveRequestTeamId(body: RequestBody, admin: any) {
  if (body.teamId && UUID_REGEX.test(body.teamId)) return body.teamId;

  if (body.generationId && UUID_REGEX.test(body.generationId)) {
    const { data } = await admin
      .from("apf_generations")
      .select("team_id")
      .eq("id", body.generationId)
      .maybeSingle();
    if (data?.team_id) return String(data.team_id);
  }

  if (body.storyId && UUID_REGEX.test(body.storyId)) {
    const { data } = await admin
      .from("user_stories")
      .select("team_id")
      .eq("id", body.storyId)
      .maybeSingle();
    if (data?.team_id) return String(data.team_id);
  }

  if (body.projectId && UUID_REGEX.test(body.projectId)) {
    const { data } = await admin
      .from("projects")
      .select("team_id")
      .eq("id", body.projectId)
      .maybeSingle();
    if (data?.team_id) return String(data.team_id);
  }

  const promptStoryId = body.prompt?.match(
    /["']hu_id["']\s*:\s*["']([0-9a-f-]{36})["']/i,
  )?.[1];
  if (promptStoryId && UUID_REGEX.test(promptStoryId)) {
    const { data } = await admin
      .from("user_stories")
      .select("team_id")
      .eq("id", promptStoryId)
      .maybeSingle();
    if (data?.team_id) return String(data.team_id);
  }

  return null;
}

async function reserveUsage(
  admin: any,
  teamId: string,
  userId: string | null,
  feature: string,
): Promise<UsageReservation | null> {
  const requestId = crypto.randomUUID();
  const { data, error } = await admin.rpc("reserve_ai_usage", {
    p_team_id: teamId,
    p_user_id: userId,
    p_feature: feature,
    p_request_id: requestId,
  });

  if (error) {
    console.error("[apf-generate] Falha ao reservar quota:", error.message);
    if (USAGE_MODE === "enforce") throw usageErrorFromMessage(error.message);
    return null;
  }

  return {
    requestId,
    data: data && typeof data === "object" ? data : null,
  };
}

async function finalizeUsage(
  admin: any,
  reservation: UsageReservation | null,
  status: "success" | "failed",
  providerId: string | null,
  errorCode: string | null,
  metadata: Record<string, unknown>,
) {
  if (!reservation) return;
  const { error } = await admin.rpc("finalize_ai_usage", {
    p_request_id: reservation.requestId,
    p_status: status,
    p_provider_id: providerId && UUID_REGEX.test(providerId) ? providerId : null,
    p_error_code: errorCode,
    p_metadata: metadata,
  });
  if (error) {
    console.error("[apf-generate] Falha ao finalizar consumo:", error.message);
  }
}

async function resolveProvider(
  providerId?: string,
  providerLegacy?: string,
  bodyApiKey?: string,
): Promise<{ row: ProviderRow; apiKey: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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

  if (
    !providerId &&
    providerLegacy &&
    bodyApiKey &&
    bodyApiKey.trim().length >= 10
  ) {
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
    if (!(data as any).is_active) {
      throw new Error("Este provedor de IA está desativado.");
    }
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

  let apiKey: string | null = null;
  const { data: keyData, error: vaultErr } = await admin.rpc(
    "get_ai_provider_key_by_id",
    { p_id: row.id as any },
  );
  if (vaultErr) {
    console.error(
      `[VAULT] Falha ao buscar key para provider "${row.name}" (${row.id}):`,
      vaultErr.message,
    );
  } else if (
    keyData &&
    typeof keyData === "string" &&
    keyData.trim().length > 0
  ) {
    apiKey = keyData.trim();
  }

  if (!apiKey) {
    const envMap: Record<string, string> = {
      sakana: "SAKANA_API_KEY",
      lovable: "LOVABLE_API_KEY",
      groq: "GROQ_API_KEY",
    };
    const envVar = envMap[row.provider_type];
    if (envVar) {
      const envKey = Deno.env.get(envVar);
      if (envKey && envKey.trim().length >= 10) apiKey = envKey.trim();
    }
  }

  if (!apiKey && bodyApiKey && bodyApiKey.trim().length >= 10) {
    apiKey = bodyApiKey.trim();
  }

  if (!apiKey) {
    throw new Error(
      `API key não configurada para "${row.name}". Configure a chave no painel administrativo.`,
    );
  }

  return { row, apiKey };
}

interface BaselineItem {
  item: string;
  tipo: string;
  complexidade: string;
  pfBruto: number | null;
  pfFs: number | null;
  inm: string | null;
  impacto: string | null;
}

interface FatorImpacto {
  nome: string;
  sigla: string;
  acao: string;
  contribuicaoFs: number;
}

interface BaselineData {
  pfBrutoTotal: number;
  itens: BaselineItem[];
  fatoresImpacto: FatorImpacto[];
}

function parseBaselineXlsx(base64: string): BaselineData {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const wb = XLSX.read(bytes, { type: "array" });
  const wsItens = wb.Sheets["Itens"];
  if (!wsItens) throw new Error("A planilha não contém a aba Itens.");
  const rawItens: any[][] = XLSX.utils.sheet_to_json(wsItens, {
    header: 1,
    defval: null,
  });
  let headerRowIdx = 6;
  for (let r = 0; r < rawItens.length; r++) {
    if (String(rawItens[r][0] ?? "").toLowerCase() === "item") {
      headerRowIdx = r;
      break;
    }
  }
  const headerRow = rawItens[headerRowIdx] as string[];
  const col = (name: string) =>
    headerRow.findIndex((h: string) =>
      String(h ?? "").toLowerCase().includes(name.toLowerCase())
    );
  const iItem = col("item");
  const iTipo = col("tipo");
  const iInm = col("inm");
  const iImpacto = col("impacto");
  const iComplex = col("complex");
  const iPfBruto = col("pf bruto");
  const iPfFs = col("pf fs");
  const TIPOS_VALIDOS = new Set(["ALI", "AIE", "SE", "CE", "EE"]);
  const itens: BaselineItem[] = [];

  for (let r = headerRowIdx + 1; r < rawItens.length; r++) {
    const row = rawItens[r];
    const tipo = String(row[iTipo] ?? "").trim().toUpperCase();
    const item = String(row[iItem] ?? "").trim();
    if (!item || !TIPOS_VALIDOS.has(tipo)) continue;
    itens.push({
      item,
      tipo,
      complexidade: String(row[iComplex] ?? "").trim(),
      pfBruto: row[iPfBruto] != null ? Number(row[iPfBruto]) : null,
      pfFs: row[iPfFs] != null ? Number(row[iPfFs]) : null,
      inm: row[iInm] != null ? String(row[iInm]).trim() : null,
      impacto: row[iImpacto] != null ? String(row[iImpacto]).trim() : null,
    });
  }

  const pfBrutoTotal = itens.reduce((sum, item) => sum + (item.pfBruto ?? 0), 0);
  const wsFi = wb.Sheets["Fator Impacto"];
  const fatoresImpacto: FatorImpacto[] = [];

  if (wsFi) {
    const rawFi: any[][] = XLSX.utils.sheet_to_json(wsFi, {
      header: 1,
      defval: null,
    });
    let fiHeaderIdx = 1;
    for (let r = 0; r < rawFi.length; r++) {
      if (String(rawFi[r][0] ?? "").toLowerCase() === "nome") {
        fiHeaderIdx = r;
        break;
      }
    }
    const fiHeader = rawFi[fiHeaderIdx] as string[];
    const fCol = (name: string) =>
      fiHeader.findIndex((h: string) =>
        String(h ?? "").toLowerCase().includes(name.toLowerCase())
      );
    const iNome = fCol("nome");
    const iSigla = fCol("sigla");
    const iAcao = fCol("ação") !== -1 ? fCol("ação") : fCol("acao");
    const iContrib = fCol("contribui");

    for (let r = fiHeaderIdx + 1; r < rawFi.length; r++) {
      const row = rawFi[r];
      const nome = String(row[iNome] ?? "").trim();
      if (!nome) continue;
      fatoresImpacto.push({
        nome,
        sigla: String(row[iSigla] ?? "").trim(),
        acao: String(row[iAcao] ?? "").trim(),
        contribuicaoFs: Number(row[iContrib] ?? 0),
      });
    }
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
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch (error: any) {
    return `[Erro ao extrair docx: ${error?.message}]`;
  }
}

async function extractFileContent(
  file: FileInput,
): Promise<{ name: string; content: string; isBaseline: boolean }> {
  const nameLower = file.name.toLowerCase();
  const isXlsx = nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls");
  const isDocx = nameLower.endsWith(".docx") || nameLower.endsWith(".doc");
  const isBaseline =
    isXlsx && (nameLower.includes("baseline") || nameLower.includes("apf"));
  const isBase64 = file.encoding === "base64" || isXlsx || isDocx;

  if (isXlsx && isBase64) {
    try {
      const data = parseBaselineXlsx(file.content);
      const summary = [
        `=== BASELINE APF — ${file.name} ===`,
        `PF Bruto Total do Baseline: ${data.pfBrutoTotal}`,
        `Total de itens: ${data.itens.length}`,
        "",
        "--- ITENS DO BASELINE ---",
        "Item | Tipo | Complexidade | PF Bruto | PF FS",
        ...data.itens.map(
          (item) =>
            `${item.item} | ${item.tipo} | ${item.complexidade} | ${item.pfBruto ?? ""} | ${item.pfFs ?? ""}`,
        ),
        "",
        "--- FATORES DE IMPACTO ---",
        "Sigla | Nome | Contribuição FS",
        ...data.fatoresImpacto.map(
          (factor) =>
            `${factor.sigla} | ${factor.nome} | ${factor.contribuicaoFs}`,
        ),
      ].join("\n");
      return { name: file.name, content: summary, isBaseline: true };
    } catch (error) {
      return {
        name: file.name,
        content: `[Erro ao processar baseline xlsx: ${error}]`,
        isBaseline: false,
      };
    }
  }

  if (isDocx && isBase64) {
    const text = await parseDocxToText(file.content);
    return {
      name: file.name,
      content: `=== MODELO DE DOCUMENTO — ${file.name} ===\n${text}`,
      isBaseline: false,
    };
  }

  return { name: file.name, content: file.content, isBaseline: false };
}

function extractPfBreakdown(markdown: string): Record<string, number> {
  const breakdown: Record<string, number> = {};
  const lines = markdown.split("\n");
  let inBreakdown = false;
  let totalPf = 0;

  for (const line of lines) {
    if (/consolidado|por hu|7\.2/i.test(line)) {
      inBreakdown = true;
      continue;
    }
    if (inBreakdown && line.trim().startsWith("|")) {
      if (/hu.*pf|pf bruto|pf fs/i.test(line)) continue;
      if (/^\s*\|\s*[-:]+/.test(line)) continue;
      const cols = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((column) => column.trim());
      if (cols.length >= 2) {
        const hu = cols[0];
        for (let index = 1; index < cols.length; index++) {
          const value = parseInt(cols[index].replace(/[^0-9]/g, ""), 10);
          if (!Number.isNaN(value) && value > 0 && value < 1000) {
            breakdown[hu] = value;
            totalPf += value;
            break;
          }
        }
      }
    }
    if (inBreakdown && /^# /.test(line)) inBreakdown = false;
  }

  if (totalPf > 0) breakdown.__total = totalPf;
  return breakdown;
}

async function persistResult(options: {
  generationId: string;
  markdown: string;
  pfBreakdown: Record<string, number>;
  docxBase64: string;
  outputFilename: string;
}) {
  const { generationId, markdown, pfBreakdown, docxBase64, outputFilename } =
    options;
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  let storagePath: string | null = null;

  if (docxBase64) {
    try {
      const docxBytes = Uint8Array.from(atob(docxBase64), (char) =>
        char.charCodeAt(0)
      );
      const { error: storageError } = await adminClient.storage
        .from("apf-documents")
        .upload(`${generationId}/${outputFilename}`, docxBytes, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });
      if (!storageError) storagePath = `${generationId}/${outputFilename}`;
    } catch {
      // Falha de storage não invalida o resultado textual.
    }
  }

  const pfTotal =
    pfBreakdown.__total ??
    Object.entries(pfBreakdown)
      .filter(([key]) => key !== "__total")
      .reduce((sum, [, value]) => sum + value, 0);

  await adminClient
    .from("apf_generations")
    .update({
      status: "success",
      output_markdown: markdown,
      pf_total: pfTotal > 0 ? pfTotal : null,
      pf_breakdown: Object.keys(pfBreakdown).length > 0 ? pfBreakdown : null,
      storage_path: storagePath,
      output_filename: outputFilename,
    })
    .eq("id", generationId);
}

function buildFullPrompt(
  prompt: string,
  processedFiles: { name: string; content: string }[] = [],
) {
  const context = processedFiles.length > 0
    ? `\n\n=== ARQUIVOS DE CONTEXTO ===\n${processedFiles
      .map((file) => `--- ${file.name} ---\n${file.content}`)
      .join("\n\n")}\n=== FIM DOS ARQUIVOS ===\n`
    : "";

  return `Você é um especialista em Análise de Pontos de Função (APF) seguindo a metodologia IFPUG e o Guia de Métricas DPF.

Siga estritamente as instruções abaixo. A resposta deve ser apenas o conteúdo do documento, em texto puro.

REGRA — BASELINE:
- Se um arquivo de BASELINE APF foi fornecido, use a lista de itens para classificar cada funcionalidade:
  - Impacto "I" (Inclusão) = funcionalidade NÃO existe no baseline
  - Impacto "A" (Alteração) = funcionalidade JÁ EXISTE no baseline
  - Impacto "E" (Exclusão) = funcionalidade foi removida
- Calcule PF FS = PF Bruto × Contribuição FS do fator de impacto aplicado

REGRA — FORMATO DO DOCUMENTO:
- Use o modelo de documento fornecido como referência de estrutura e seções
- Mantenha as mesmas seções numeradas: 1. Dados do Atendimento, 2. Contexto, 3. Tabela de Funcionalidades, 4. Funcionalidades Impactadas na Baseline, 5. Itens Não Identificados, 6. Banco de Dados, 7. Contagem de PF (7.1 Detalhamento, 7.2 Consolidado por HU, 7.3 Resumo Executivo), 8. Solicitação de Mudança, 9. Legenda
- SEMPRE gere a seção 7.2 com a tabela: | HU / Escopo | Qtd. Funções | PF Bruto | PF FS |

REGRA — TABELAS:
- Use formato Markdown padrão com pipes e linha separadora
- NÃO inclua tabela dentro de bloco de código

REGRA CRÍTICA — PERGUNTAS NO PROMPT:
- NÃO inclua perguntas literais no documento gerado
- Se houver "=== RESPOSTAS DO USUÁRIO ===", incorpore as respostas naturalmente ao texto
${context}
=== INSTRUÇÕES DO USUÁRIO ===
${prompt}`;
}

class ProviderError extends Error {
  status: number;
  providerName: string;

  constructor(providerName: string, status: number, message: string) {
    super(`${providerName} [${status}]: ${message}`);
    this.status = status;
    this.providerName = providerName;
  }
}

function providerSignal() {
  return AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
}

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
  const response = await fetch(apiBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: providerSignal(),
  });
  if (!response.ok) {
    throw new ProviderError(providerName, response.status, await response.text());
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error(
      `${providerName} retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return text;
}

async function callGemini(
  prompt: string,
  apiKey: string,
  model = "gemini-2.0-flash",
): Promise<string> {
  if (model.startsWith("google/")) model = model.replace("google/", "");
  if (/^gemini-1\.5-(flash|pro)(-latest)?$/i.test(model)) {
    model = "gemini-2.0-flash";
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: providerSignal(),
    },
  );
  const data = await response.json();
  if (!response.ok || data.error) {
    const message = data.error?.message ?? data.error ?? `HTTP ${response.status}`;
    throw new ProviderError("Gemini", response.status || 500, String(message));
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason ?? "sem candidatos";
    throw new Error(
      `Gemini retornou conteúdo vazio (motivo: ${reason}). Verifique o modelo "${model}" e a chave.`,
    );
  }
  return text;
}

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model = "claude-3-5-sonnet-20241022",
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: providerSignal(),
  });
  if (!response.ok) {
    throw new ProviderError("Anthropic", response.status, await response.text());
  }
  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  if (!text) {
    throw new Error(
      `Anthropic retornou resposta inesperada: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return text;
}

async function callProvider(
  row: ProviderRow,
  prompt: string,
  apiKey: string,
  modelOverride?: string,
): Promise<string> {
  const model = modelOverride ?? row.model ?? "";
  const format = row.request_format ?? "openai_compatible";

  if (format === "gemini") {
    return await callGemini(prompt, apiKey, model || "gemini-2.0-flash");
  }
  if (format === "anthropic") {
    return await callAnthropic(
      prompt,
      apiKey,
      model || "claude-3-5-sonnet-20241022",
    );
  }

  const baseUrl = row.api_base_url;
  if (!baseUrl) {
    throw new Error(`Provider "${row.name}" sem api_base_url configurada.`);
  }

  const defaultModels: Record<string, string> = {
    openai: "gpt-4o-mini",
    lovable: "google/gemini-2.5-flash",
    perplexity: "sonar",
    sakana: "fugu",
    groq: "llama-3.3-70b-versatile",
  };
  const finalModel = model || defaultModels[row.provider_type] || "";
  if (!finalModel) {
    throw new Error(`Provider "${row.name}" sem modelo configurado.`);
  }
  const extraBody = row.provider_type === "sakana"
    ? { reasoning: { effort: "high" } }
    : undefined;
  return await callGeneric(
    row.name,
    baseUrl,
    prompt,
    apiKey,
    finalModel,
    extraBody,
  );
}

async function listActiveProvidersForFallback(
  excludeId?: string,
): Promise<ProviderRow[]> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model,api_base_url,request_format,is_active")
    .eq("is_active", true)
    .order("is_recommended", { ascending: false })
    .order("name");
  const list = (data ?? []) as ProviderRow[];
  return (excludeId ? list.filter((provider) => provider.id !== excludeId) : list)
    .slice(0, Math.max(0, MAX_FALLBACK_PROVIDERS));
}

async function getProviderKey(row: ProviderRow): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin.rpc("get_ai_provider_key_by_id", {
    p_id: row.id,
  });
  let key = (data as string) ?? null;
  if (!key && row.provider_type === "lovable") {
    key = Deno.env.get("LOVABLE_API_KEY") ?? null;
  }
  if (!key && row.provider_type === "sakana") {
    key = Deno.env.get("SAKANA_API_KEY") ?? null;
  }
  if (!key && row.provider_type === "groq") {
    key = Deno.env.get("GROQ_API_KEY") ?? null;
  }
  return key;
}

function isFallbackableStatus(status: number): boolean {
  return status === 402 || status === 404 || status === 429 ||
    (status >= 500 && status < 600);
}

function mapErrorToReason(
  error: unknown,
): { reason: string; userMessage: string; status: number } {
  if (error instanceof UsageError) {
    return {
      reason: error.code,
      status: error.status,
      userMessage: error.message,
    };
  }
  if (error instanceof ProviderError) {
    if (error.status === 402) {
      return {
        reason: "AI_PROVIDER_PAYMENT_REQUIRED",
        status: 402,
        userMessage: "O serviço de IA está sem créditos. Tente outro provedor.",
      };
    }
    if (error.status === 429) {
      return {
        reason: "AI_PROVIDER_RATE_LIMITED",
        status: 429,
        userMessage: "Muitas requisições em sequência. Aguarde e tente novamente.",
      };
    }
    if (error.status === 404) {
      return {
        reason: "AI_PROVIDER_MODEL_NOT_FOUND",
        status: 404,
        userMessage: `Modelo não encontrado para "${error.providerName}".`,
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        reason: "AI_PROVIDER_AUTH",
        status: error.status,
        userMessage: `Chave de API inválida para "${error.providerName}".`,
      };
    }
    if (error.status >= 500) {
      return {
        reason: "AI_PROVIDER_UNAVAILABLE",
        status: error.status,
        userMessage: `O serviço "${error.providerName}" está temporariamente indisponível.`,
      };
    }
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      reason: "AI_PROVIDER_TIMEOUT",
      status: 504,
      userMessage: "O provedor de IA excedeu o tempo máximo de resposta.",
    };
  }
  return {
    reason: "AI_PROVIDER_ERROR",
    status: 500,
    userMessage: "Não foi possível gerar o documento agora. Tente novamente.",
  };
}

const HEADER_FILL = "1F4E78";
const KEY_FILL = "D9D9D9";
const BORDER_COLOR = "9DB2BF";
const cellBorder = {
  style: BorderStyle.SINGLE,
  size: 6,
  color: BORDER_COLOR,
};
const cellBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

function makeCell(
  text: string,
  options: { header?: boolean; keyCol?: boolean; width: number } = {
    width: 4680,
  },
): TableCell {
  const isBold = Boolean(options.header || options.keyCol);
  const fill = options.header ? HEADER_FILL : options.keyCol ? KEY_FILL : undefined;
  const color = options.header ? "FFFFFF" : "000000";
  return new TableCell({
    borders: cellBorders,
    width: { size: options.width, type: WidthType.DXA },
    shading: fill
      ? { fill, type: ShadingType.CLEAR, color: "auto" }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || "",
            bold: isBold,
            color,
            size: 20,
          }),
        ],
      }),
    ],
  });
}

function parseMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function buildDocxTable(headerCells: string[], rows: string[][]): Table {
  const totalWidth = 9360;
  const colCount = Math.max(
    headerCells.length,
    ...rows.map((row) => row.length),
    1,
  );
  const colWidth = Math.floor(totalWidth / colCount);
  const isKeyValue =
    colCount === 2 &&
    headerCells.every((header) =>
      !header || /^(campo|chave|item|atributo)$/i.test(header)
    );
  const tableRows: TableRow[] = [];

  if (!isKeyValue) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: headerCells
          .concat(Array(colCount - headerCells.length).fill(""))
          .map((header) =>
            makeCell(header, { header: true, width: colWidth })
          ),
      }),
    );
  }

  for (const row of rows) {
    const padded = row.concat(Array(colCount - row.length).fill(""));
    tableRows.push(
      new TableRow({
        children: padded.map((cellText, index) =>
          makeCell(cellText, {
            keyCol: isKeyValue && index === 0,
            width: colWidth,
          })
        ),
      }),
    );
  }

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth),
    rows: tableRows,
  });
}

function textToDocxBlocks(text: string): (Paragraph | Table)[] {
  const lines = text.split(/\r?\n/);
  const blocks: (Paragraph | Table)[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    if (
      line.trim().startsWith("|") &&
      index + 1 < lines.length &&
      isSeparatorRow(lines[index + 1])
    ) {
      const header = parseMarkdownRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(parseMarkdownRow(lines[index]));
        index += 1;
      }
      blocks.push(buildDocxTable(header, rows));
      blocks.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }

    if (!line.trim()) {
      blocks.push(new Paragraph({ children: [new TextRun("")] }));
    } else if (line.startsWith("# ")) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({ text: line.slice(2), bold: true, size: 32 }),
          ],
          spacing: { before: 240, after: 160 },
        }),
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: line.slice(3), bold: true, size: 28 }),
          ],
          spacing: { before: 200, after: 120 },
        }),
      );
    } else if (line.startsWith("### ")) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({ text: line.slice(4), bold: true, size: 24 }),
          ],
          spacing: { before: 160, after: 100 },
        }),
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push(
        new Paragraph({
          children: [new TextRun(line.slice(2))],
          bullet: { level: 0 },
        }),
      );
    } else {
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun(line)],
          spacing: { after: 120 },
        }),
      );
    }
    index += 1;
  }

  return blocks;
}

async function generateDocxBase64(text: string): Promise<string> {
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: textToDocxBlocks(text),
      },
    ],
  });
  const buffer = await Packer.toBuffer(document);
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(index, index + chunkSize)) as any,
    );
  }
  return btoa(binary);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let reservation: UsageReservation | null = null;
  let privileged = false;
  let usedProviderId: string | null = null;
  const startedAt = Date.now();

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const token = authHeader.slice(7);
    const isServiceRole = Boolean(SERVICE_KEY && token === SERVICE_KEY);
    let userId: string | null = null;

    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser();
      if (authError || !user) {
        return jsonResponse({ error: "Token inválido" }, 401);
      }
      userId = user.id;
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    validatePayload(body);

    const platformAdmin = await isPlatformAdmin(admin, userId);
    privileged = isServiceRole || platformAdmin;

    if (body.testMode && !privileged) {
      return jsonResponse(
        { error: "Somente administradores podem testar provedores de IA." },
        403,
      );
    }

    const {
      prompt,
      provider,
      providerId,
      files,
      generationId,
      testMode,
    } = body;

    if (!providerId && (!provider || !privileged)) {
      return jsonResponse({ error: "providerId é obrigatório" }, 400);
    }
    if (providerId && !UUID_REGEX.test(providerId)) {
      return jsonResponse({ error: "providerId deve ser um UUID válido" }, 400);
    }
    if (generationId && !UUID_REGEX.test(generationId)) {
      return jsonResponse({ error: "generationId deve ser um UUID válido" }, 400);
    }

    const { row: resolved, apiKey } = await resolveProvider(
      providerId,
      privileged ? provider : undefined,
      privileged ? body.apiKey : undefined,
    );
    usedProviderId = resolved.id;
    const modelOverride = privileged ? body.model : undefined;

    if (testMode) {
      const testStartedAt = Date.now();
      try {
        const sample = await callProvider(
          resolved,
          "Responda apenas com a palavra: OK",
          apiKey,
          modelOverride,
        );
        return jsonResponse({
          success: true,
          providerUsed: resolved.name,
          providerType: resolved.provider_type,
          model: resolved.model,
          latencyMs: Date.now() - testStartedAt,
          sample: (sample || "").slice(0, 200),
        });
      } catch (error) {
        const status = error instanceof ProviderError ? error.status : 500;
        const { reason, userMessage } = mapErrorToReason(error);
        return jsonResponse({
          success: false,
          testMode: true,
          providerUsed: resolved.name,
          providerType: resolved.provider_type,
          status,
          reason,
          userMessage,
          rawError: error instanceof Error ? error.message : String(error),
          latencyMs: Date.now() - testStartedAt,
        });
      }
    }

    const teamId = await resolveRequestTeamId(body, admin);
    if (!teamId) {
      throw new UsageError(
        "AI_TEAM_REQUIRED",
        400,
        "Não foi possível identificar o time responsável pela solicitação.",
      );
    }

    const processedFiles: { name: string; content: string }[] = [];
    for (const file of files ?? []) {
      const extracted = await extractFileContent(file);
      processedFiles.push({ name: extracted.name, content: extracted.content });
    }

    const fullPrompt = buildFullPrompt(prompt, processedFiles);
    if (fullPrompt.length > MAX_PROMPT_CHARS + MAX_TOTAL_FILE_CHARS) {
      throw new UsageError(
        "AI_CONTEXT_TOO_LARGE",
        413,
        "O contexto final excede o limite permitido.",
      );
    }

    reservation = await reserveUsage(
      admin,
      teamId,
      userId,
      body.feature?.trim() || "apf_generate",
    );

    let aiText = "";
    let usedProviderName = resolved.name;
    let fallbackInfo: { from: string; to: string; reason: string } | null = null;
    const attempts: Array<{ name: string; status?: number; error: string }> = [];

    try {
      aiText = await callProvider(resolved, fullPrompt, apiKey, modelOverride);
    } catch (primaryError) {
      const primaryStatus = primaryError instanceof ProviderError
        ? primaryError.status
        : 500;
      attempts.push({
        name: resolved.name,
        status: primaryStatus,
        error: primaryError instanceof Error
          ? primaryError.message
          : String(primaryError),
      });

      if (!isFallbackableStatus(primaryStatus)) throw primaryError;

      const candidates = await listActiveProvidersForFallback(providerId);
      let succeeded = false;

      for (const candidate of candidates) {
        try {
          const candidateKey = await getProviderKey(candidate);
          if (!candidateKey) {
            attempts.push({
              name: candidate.name,
              error: "Sem API key configurada",
            });
            continue;
          }
          aiText = await callProvider(
            candidate,
            fullPrompt,
            candidateKey,
            candidate.model ?? undefined,
          );
          usedProviderName = candidate.name;
          usedProviderId = candidate.id;
          fallbackInfo = {
            from: resolved.name,
            to: candidate.name,
            reason: primaryStatus === 402
              ? "sem créditos"
              : `falha HTTP ${primaryStatus}`,
          };
          succeeded = true;
          break;
        } catch (fallbackError) {
          const fallbackStatus = fallbackError instanceof ProviderError
            ? fallbackError.status
            : 500;
          attempts.push({
            name: candidate.name,
            status: fallbackStatus,
            error: fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
          });
        }
      }

      if (!succeeded) {
        const { reason, userMessage } = mapErrorToReason(primaryError);
        if (generationId) {
          await admin
            .from("apf_generations")
            .update({ status: "error", error_message: userMessage })
            .eq("id", generationId);
        }
        await finalizeUsage(
          admin,
          reservation,
          "failed",
          usedProviderId,
          reason,
          {
            latency_ms: Date.now() - startedAt,
            attempts: attempts.length,
          },
        );
        reservation = null;
        return jsonResponse({ success: false, reason, userMessage, attempts });
      }
    }

    if (!aiText.trim()) throw new Error("A IA retornou conteúdo vazio");

    const docxBase64 = body.skipDocx ? "" : await generateDocxBase64(aiText);
    const pfBreakdown = extractPfBreakdown(aiText);
    const pfTotal = pfBreakdown.__total ?? null;
    const outputFilename =
      `Evidencia_APF_${new Date().toISOString().slice(0, 10)}.docx`;

    if (generationId) {
      await persistResult({
        generationId,
        markdown: aiText,
        pfBreakdown,
        docxBase64,
        outputFilename,
      });
    }

    await finalizeUsage(
      admin,
      reservation,
      "success",
      usedProviderId,
      null,
      {
        latency_ms: Date.now() - startedAt,
        response_chars: aiText.length,
        files_count: files?.length ?? 0,
        fallback_used: Boolean(fallbackInfo),
      },
    );
    reservation = null;

    const usage = reservation?.data ?? null;
    return jsonResponse({
      success: true,
      docxBase64,
      markdown: aiText,
      charCount: aiText.length,
      pfBreakdown,
      pfTotal,
      outputFilename,
      providerUsed: usedProviderName,
      fallback: fallbackInfo,
      usageMode: USAGE_MODE,
      usage,
    });
  } catch (error: unknown) {
    console.error("apf-generate error:", error);
    const raw = error instanceof Error ? error.message : "Erro desconhecido";
    const mapped = mapErrorToReason(error);

    await finalizeUsage(
      admin,
      reservation,
      "failed",
      usedProviderId,
      mapped.reason,
      { latency_ms: Date.now() - startedAt },
    );

    let friendly = raw;
    if (/credit balance is too low/i.test(raw)) {
      friendly = "Conta sem créditos. Contate o administrador.";
    } else if (/invalid.*api.key|incorrect api key/i.test(raw)) {
      friendly = "Chave de API inválida. Contate o administrador.";
    } else if (/rate limit|429/i.test(raw)) {
      friendly = "Limite de requisições atingido. Aguarde e tente novamente.";
    } else if (!privileged) {
      friendly = mapped.userMessage;
    }

    const httpStatus = error instanceof UsageError
      ? error.status
      : isFallbackableStatus(mapped.status)
        ? 200
        : mapped.status >= 400 && mapped.status < 600
          ? mapped.status
          : 500;

    return jsonResponse(
      {
        success: false,
        reason: mapped.reason,
        userMessage: friendly !== raw ? friendly : mapped.userMessage,
        ...(privileged ? { rawError: raw } : {}),
      },
      httpStatus,
    );
  }
});

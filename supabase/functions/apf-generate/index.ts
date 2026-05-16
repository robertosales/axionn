// deno-lint-ignore-file no-explicit-any
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Provider = "lovable" | "openai" | "gemini" | "anthropic" | "perplexity";

interface FileInput {
  name: string;
  content: string;   // base64 para xlsx/docx, texto para outros
  encoding?: "base64" | "text";
  mimeType?: string;
}

interface RequestBody {
  prompt: string;
  provider: Provider;
  apiKey?: string;
  model?: string;
  files?: FileInput[];
  generationId?: string; // ID do registro em apf_generations para atualizar
  supabaseUrl?: string;
  supabaseServiceKey?: string;
}

// ─────────────────────────────────────────────
// PARSER 1 — Baseline xlsx
// Lê abas "Itens" e "Fator Impacto" e retorna JSON estruturado
// ─────────────────────────────────────────────
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

  // ── Aba Itens (header na linha 6, índice 6) ──
  const wsItens = wb.Sheets["Itens"];
  const rawItens: any[][] = XLSX.utils.sheet_to_json(wsItens, { header: 1, defval: null });

  // Encontrar a linha de cabeçalho dinamicamente
  let headerRowIdx = 6;
  for (let r = 0; r < rawItens.length; r++) {
    if (String(rawItens[r][0] ?? "").toLowerCase() === "item") {
      headerRowIdx = r;
      break;
    }
  }
  const headerRow = rawItens[headerRowIdx] as string[];
  const col = (name: string) => headerRow.findIndex((h: string) =>
    String(h ?? "").toLowerCase().includes(name.toLowerCase())
  );

  const iItem = col("item");
  const iTipo = col("tipo");
  const iInm  = col("inm");
  const iImpacto = col("impacto");
  const iComplex = col("complex");
  const iPfBruto = col("pf bruto");
  const iPfFs   = col("pf fs");

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
      pfFs:    row[iPfFs]    != null ? Number(row[iPfFs])    : null,
      inm:     row[iInm]     != null ? String(row[iInm]).trim() : null,
      impacto: row[iImpacto] != null ? String(row[iImpacto]).trim() : null,
    });
  }

  const pfBrutoTotal = itens.reduce((s, i) => s + (i.pfBruto ?? 0), 0);

  // ── Aba Fator Impacto (header na linha 1) ──
  const wsFi = wb.Sheets["Fator Impacto"];
  const rawFi: any[][] = XLSX.utils.sheet_to_json(wsFi, { header: 1, defval: null });

  // Encontrar header dinamicamente
  let fiHeaderIdx = 1;
  for (let r = 0; r < rawFi.length; r++) {
    if (String(rawFi[r][0] ?? "").toLowerCase() === "nome") {
      fiHeaderIdx = r;
      break;
    }
  }
  const fiHeader = rawFi[fiHeaderIdx] as string[];
  const fCol = (name: string) => fiHeader.findIndex((h: string) =>
    String(h ?? "").toLowerCase().includes(name.toLowerCase())
  );

  const iNome     = fCol("nome");
  const iSigla    = fCol("sigla");
  const iAcao     = fCol("ação") !== -1 ? fCol("ação") : fCol("acao");
  const iContrib  = fCol("contribui");

  const fatoresImpacto: FatorImpacto[] = [];
  for (let r = fiHeaderIdx + 1; r < rawFi.length; r++) {
    const row = rawFi[r];
    const nome = String(row[iNome] ?? "").trim();
    if (!nome) continue;
    fatoresImpacto.push({
      nome,
      sigla:         String(row[iSigla]   ?? "").trim(),
      acao:          String(row[iAcao]    ?? "").trim(),
      contribuicaoFs: Number(row[iContrib] ?? 0),
    });
  }

  return { pfBrutoTotal, itens, fatoresImpacto };
}

// ─────────────────────────────────────────────
// PARSER 2 — Modelo de evidência .docx
// Extrai texto estruturado do docx usando xml puro (sem deps extras)
// ─────────────────────────────────────────────
async function parseDocxToText(base64: string): Promise<string> {
  // O docx é um ZIP. Vamos extrair word/document.xml e converter para texto simples.
  // Usamos DecompressionStream disponível no Deno runtime.
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Usa JSZip via esm.sh para extrair o XML
    const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
    const zip = await JSZip.loadAsync(bytes);
    const xmlFile = zip.file("word/document.xml");
    if (!xmlFile) return "[Não foi possível extrair o conteúdo do .docx]";

    const xmlText = await xmlFile.async("text");

    // Extrai texto limpo do XML Word
    // Remove tags XML e preserva quebras de parágrafo
    const text = xmlText
      .replace(/<w:br[^/]*/g, "\n")           // quebra de linha Word
      .replace(/<\/w:p>/g, "\n")              // fim de parágrafo → nova linha
      .replace(/<\/w:tr>/g, "\n")             // fim de linha de tabela
      .replace(/<\/w:tc>/g, " | ")            // fim de célula de tabela
      .replace(/<[^>]+>/g, "")               // remove todas as tags restantes
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, " ")               // colapsa espaços múltiplos
      .replace(/\n{3,}/g, "\n\n")            // máximo 2 linhas em branco
      .trim();

    return text;
  } catch (e: any) {
    return `[Erro ao extrair docx: ${e?.message}]`;
  }
}

// ─────────────────────────────────────────────
// Detecta tipo de arquivo e extrai conteúdo
// ─────────────────────────────────────────────
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
        `Total de itens: ${data.itens.length}`,
        ``,
        `--- ITENS DO BASELINE (use para identificar funções existentes vs novas) ---`,
        `Item | Tipo | Complexidade | PF Bruto | PF FS`,
        ...data.itens.map(i =>
          `${i.item} | ${i.tipo} | ${i.complexidade} | ${i.pfBruto ?? ""} | ${i.pfFs ?? ""}`
        ),
        ``,
        `--- FATORES DE IMPACTO (use para calcular PF FS) ---`,
        `Sigla | Nome | Contribuição FS`,
        ...data.fatoresImpacto.map(f =>
          `${f.sigla} | ${f.nome} | ${f.contribuicaoFs}`
        ),
      ].join("\n");
      return { name: file.name, content: summary, isBaseline: true };
    } catch (_e) {
      return { name: file.name, content: `[Erro ao processar baseline xlsx: ${_e}]`, isBaseline: false };
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

  // Arquivo de texto normal
  return { name: file.name, content: file.content, isBaseline: false };
}

// ─────────────────────────────────────────────
// Extrai pf_breakdown da resposta da IA
// Procura pela tabela da seção 7.2 (Consolidado por HU)
// ─────────────────────────────────────────────
function extractPfBreakdown(markdown: string): Record<string, number> {
  const breakdown: Record<string, number> = {};
  const lines = markdown.split("\n");
  let inBreakdown = false;
  let totalPf = 0;

  for (const line of lines) {
    // Detecta seção 7.2 ou qualquer tabela com coluna PF
    if (/consolidado|por hu|7\.2/i.test(line)) {
      inBreakdown = true;
      continue;
    }
    if (inBreakdown && line.trim().startsWith("|")) {
      // Ignora linha de cabeçalho e separador
      if (/hu.*pf|pf bruto|pf fs/i.test(line)) continue;
      if (/^\s*\|\s*[-:]+/.test(line)) continue;

      const cols = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
      if (cols.length >= 2) {
        const hu = cols[0];
        // Pega a primeira coluna numérica que pareça PF (normalmente col 2 ou 3)
        for (let c = 1; c < cols.length; c++) {
          const num = parseInt(cols[c].replace(/[^0-9]/g, ""), 10);
          if (!isNaN(num) && num > 0 && num < 1000) {
            breakdown[hu] = num;
            totalPf += num;
            break;
          }
        }
      }
    }
    // Encerra ao encontrar nova seção de nível 1
    if (inBreakdown && /^# /.test(line)) inBreakdown = false;
  }

  if (totalPf > 0) breakdown["__total"] = totalPf;
  return breakdown;
}

// ─────────────────────────────────────────────
// Persiste resultado no banco via Supabase REST
// ─────────────────────────────────────────────
async function persistResult(opts: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  generationId: string;
  markdown: string;
  pfBreakdown: Record<string, number>;
  docxBase64: string;
  outputFilename: string;
}) {
  const { supabaseUrl, supabaseServiceKey, generationId, markdown, pfBreakdown, docxBase64, outputFilename } = opts;

  // 1. Salvar docx no Storage
  let storagePath: string | null = null;
  try {
    const docxBytes = Uint8Array.from(atob(docxBase64), c => c.charCodeAt(0));
    const storageRes = await fetch(
      `${supabaseUrl}/storage/v1/object/apf-documents/${generationId}/${outputFilename}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        body: docxBytes,
      }
    );
    if (storageRes.ok) storagePath = `${generationId}/${outputFilename}`;
  } catch (_e) {
    // Storage falhou — não bloqueia o fluxo
  }

  // 2. Calcular pf_total (soma dos valores exceto __total)
  const pfTotal = pfBreakdown["__total"] ??
    Object.entries(pfBreakdown)
      .filter(([k]) => k !== "__total")
      .reduce((s, [, v]) => s + v, 0);

  // 3. Atualizar registro em apf_generations
  await fetch(
    `${supabaseUrl}/rest/v1/apf_generations?id=eq.${generationId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "success",
        output_markdown: markdown,
        pf_total: pfTotal > 0 ? pfTotal : null,
        pf_breakdown: Object.keys(pfBreakdown).length > 0 ? pfBreakdown : null,
        storage_path: storagePath,
        output_filename: outputFilename,
      }),
    }
  );
}

// ─────────────────────────────────────────────
// Build do prompt enriquecido
// ─────────────────────────────────────────────
function buildFullPrompt(prompt: string, processedFiles: { name: string; content: string }[] = []) {
  const ctx =
    processedFiles.length > 0
      ? `\n\n=== ARQUIVOS DE CONTEXTO ===\n${processedFiles
          .map((f) => `--- ${f.name} ---\n${f.content}`)
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
${ctx}
=== INSTRUÇÕES DO USUÁRIO ===
${prompt}`;
}

// ─────────────────────────────────────────────
// Chamadas aos provedores de IA
// ─────────────────────────────────────────────
async function callLovable(fullPrompt: string, apiKey: string, model = "google/gemini-2.5-flash") {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: fullPrompt }],
    }),
  });
  if (!r.ok) throw new Error(`Lovable AI [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callOpenAI(fullPrompt: string, apiKey: string, model = "gpt-4o-mini") {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: fullPrompt }] }),
  });
  if (!r.ok) throw new Error(`OpenAI [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(fullPrompt: string, apiKey: string, model = "gemini-1.5-flash") {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
  });
  if (!r.ok) throw new Error(`Gemini [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callAnthropic(fullPrompt: string, apiKey: string, model = "claude-3-5-sonnet-20241022") {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages: [{ role: "user", content: fullPrompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return data.content?.[0]?.text ?? "";
}

async function callPerplexity(fullPrompt: string, apiKey: string, model = "sonar") {
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: fullPrompt }] }),
  });
  if (!r.ok) throw new Error(`Perplexity [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─────────────────────────────────────────────
// DOCX builder (mantido igual ao original)
// ─────────────────────────────────────────────
const HEADER_FILL = "1F4E78";
const KEY_FILL = "D9D9D9";
const BORDER_COLOR = "9DB2BF";
const cellBorder = { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function makeCell(text: string, opts: { header?: boolean; keyCol?: boolean; width: number } = { width: 4680 }): TableCell {
  const isBold = !!opts.header || !!opts.keyCol;
  const fill = opts.header ? HEADER_FILL : opts.keyCol ? KEY_FILL : undefined;
  const color = opts.header ? "FFFFFF" : "000000";
  return new TableCell({
    borders: cellBorders,
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

function buildTable(headerCells: string[], rows: string[][]): Table {
  const TOTAL_WIDTH = 9360;
  const colCount = Math.max(headerCells.length, ...rows.map((r) => r.length), 1);
  const colWidth = Math.floor(TOTAL_WIDTH / colCount);
  const isKeyValue = colCount === 2 && headerCells.every((h) => !h || /^(campo|chave|item|atributo)$/i.test(h));
  const trs: TableRow[] = [];
  if (!isKeyValue) {
    trs.push(new TableRow({
      tableHeader: true,
      children: headerCells.concat(Array(colCount - headerCells.length).fill(""))
        .map((h) => makeCell(h, { header: true, width: colWidth })),
    }));
  }
  for (const r of rows) {
    const padded = r.concat(Array(colCount - r.length).fill(""));
    trs.push(new TableRow({ children: padded.map((cellText, idx) => makeCell(cellText, { keyCol: isKeyValue && idx === 0, width: colWidth })) }));
  }
  return new Table({ width: { size: TOTAL_WIDTH, type: WidthType.DXA }, columnWidths: Array(colCount).fill(colWidth), rows: trs });
}

function textToDocxBlocks(text: string): (Paragraph | Table)[] {
  const lines = text.split(/\r?\n/);
  const blocks: (Paragraph | Table)[] = [];
  let i = 0;
  const pushParagraph = (p: Paragraph) => blocks.push(p);
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (line.trim().startsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = parseMarkdownRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(parseMarkdownRow(lines[i])); i++; }
      blocks.push(buildTable(header, rows));
      blocks.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }
    if (!line.trim()) { pushParagraph(new Paragraph({ children: [new TextRun("")] })); }
    else if (line.startsWith("# ")) { pushParagraph(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: line.slice(2), bold: true, size: 32 })], spacing: { before: 240, after: 160 } })); }
    else if (line.startsWith("## ")) { pushParagraph(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.slice(3), bold: true, size: 28 })], spacing: { before: 200, after: 120 } })); }
    else if (line.startsWith("### ")) { pushParagraph(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: line.slice(4), bold: true, size: 24 })], spacing: { before: 160, after: 100 } })); }
    else if (line.startsWith("- ") || line.startsWith("* ")) { pushParagraph(new Paragraph({ children: [new TextRun(line.slice(2))], bullet: { level: 0 } })); }
    else { pushParagraph(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun(line)], spacing: { after: 120 } })); }
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
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

// ─────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    const { prompt, provider, apiKey, model, files, generationId, supabaseUrl, supabaseServiceKey } = body;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Etapa 1: Processar arquivos (xlsx + docx) ──
    const processedFiles: { name: string; content: string }[] = [];
    for (const file of files ?? []) {
      const extracted = await extractFileContent(file);
      processedFiles.push({ name: extracted.name, content: extracted.content });
    }

    // ── Etapa 2: Chamar a IA ──
    const fullPrompt = buildFullPrompt(prompt, processedFiles);
    let aiText = "";

    switch (provider) {
      case "lovable": {
        const key = apiKey?.trim() || Deno.env.get("LOVABLE_API_KEY") || "";
        if (!key) throw new Error("LOVABLE_API_KEY não configurado");
        aiText = await callLovable(fullPrompt, key, model);
        break;
      }
      case "openai": {
        if (!apiKey) throw new Error("API key da OpenAI é obrigatória");
        aiText = await callOpenAI(fullPrompt, apiKey, model);
        break;
      }
      case "gemini": {
        if (!apiKey) throw new Error("API key do Gemini é obrigatória");
        aiText = await callGemini(fullPrompt, apiKey, model);
        break;
      }
      case "anthropic": {
        if (!apiKey) throw new Error("API key do Claude é obrigatória");
        aiText = await callAnthropic(fullPrompt, apiKey, model);
        break;
      }
      case "perplexity": {
        if (!apiKey) throw new Error("API key do Perplexity é obrigatória");
        aiText = await callPerplexity(fullPrompt, apiKey, model);
        break;
      }
      default:
        throw new Error(`Provider inválido: ${provider}`);
    }

    if (!aiText.trim()) throw new Error("A IA retornou conteúdo vazio");

    // ── Etapa 3: Gerar docx + extrair breakdown + persistir ──
    const docxBase64 = await generateDocxBase64(aiText);
    const pfBreakdown = extractPfBreakdown(aiText);
    const pfTotal = pfBreakdown["__total"] ?? null;

    // Persistir no banco se generationId e credenciais foram passados
    const sbUrl = supabaseUrl || Deno.env.get("SUPABASE_URL") || "";
    const sbKey = supabaseServiceKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const outputFilename = `Evidencia_APF_${new Date().toISOString().slice(0, 10)}.docx`;

    if (generationId && sbUrl && sbKey) {
      await persistResult({
        supabaseUrl: sbUrl,
        supabaseServiceKey: sbKey,
        generationId,
        markdown: aiText,
        pfBreakdown,
        docxBase64,
        outputFilename,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        docxBase64,
        markdown: aiText,
        charCount: aiText.length,
        pfBreakdown,
        pfTotal,
        outputFilename,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("apf-generate error:", e);
    const raw = e?.message ?? "Erro desconhecido";
    let friendly = raw;
    if (/credit balance is too low/i.test(raw)) {
      friendly = "A conta Anthropic (Claude) associada à chave informada está sem créditos. Adicione créditos em https://console.anthropic.com/settings/billing ou selecione 'Lovable AI' como provedor.";
    } else if (/invalid x-api-key|invalid api key|incorrect api key/i.test(raw)) {
      friendly = "Chave de API inválida para o provedor selecionado. Verifique e tente novamente.";
    } else if (/rate limit|429/i.test(raw)) {
      friendly = "Limite de requisições atingido no provedor. Aguarde alguns segundos e tente novamente.";
    }
    return new Response(
      JSON.stringify({ error: friendly, raw }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

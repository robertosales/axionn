/**
 * Edge Function: apf-embeddings
 * Processa a fila de embeddings (apf_embedding_queue).
 * Deve ser chamada a cada 5 minutos via pg_cron ou Supabase Scheduled Functions.
 *
 * POST /apf-embeddings  (sem body — processa o lote pendente)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 3;
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text.slice(0, 8000),  // limite seguro de tokens
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Embeddings API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Recupera a API key da OpenAI do Vault
  const { data: vaultData } = await supabase.rpc("get_secret", { secret_name: "openai_api_key" });
  const openaiKey = vaultData ?? Deno.env.get("OPENAI_API_KEY");

  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Busca lote de itens pendentes
  const { data: queue, error: queueError } = await supabase
    .from("apf_embedding_queue")
    .select("id, event_id, attempts")
    .in("status", ["pending", "error"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (queueError) {
    return new Response(
      JSON.stringify({ error: queueError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!queue || queue.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, message: "Fila vazia" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Marca como 'processing'
  await supabase
    .from("apf_embedding_queue")
    .update({ status: "processing" })
    .in("id", queue.map((q) => q.id));

  let processed = 0;
  let errors = 0;

  for (const item of queue) {
    try {
      // Busca o texto da HU
      const { data: event } = await supabase
        .from("apf_validation_events")
        .select("id, hu_text, hu_title")
        .eq("id", item.event_id)
        .single();

      if (!event) throw new Error("Evento não encontrado: " + item.event_id);

      // Gera o embedding
      // Usa título + texto para melhor representação semântica
      const inputText = event.hu_title
        ? `${event.hu_title}\n\n${event.hu_text}`
        : event.hu_text;

      const embedding = await generateEmbedding(inputText, openaiKey);

      // Persiste o embedding no evento
      await supabase
        .from("apf_validation_events")
        .update({
          hu_embedding: `[${embedding.join(",")}]`,
          embedding_generated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      // Marca a fila como concluída
      await supabase
        .from("apf_embedding_queue")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .eq("id", item.id);

      processed++;
    } catch (err) {
      errors++;
      console.error(`Erro ao gerar embedding para event_id=${item.event_id}:`, err);

      await supabase
        .from("apf_embedding_queue")
        .update({
          status: item.attempts + 1 >= MAX_ATTEMPTS ? "error" : "pending",
          attempts: item.attempts + 1,
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", item.id);
    }
  }

  return new Response(
    JSON.stringify({
      processed,
      errors,
      total_in_batch: queue.length,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

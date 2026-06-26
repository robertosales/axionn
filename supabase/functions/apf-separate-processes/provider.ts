// deno-lint-ignore-file no-explicit-any
export type RequestFormat = "openai_compatible" | "gemini" | "anthropic";

export interface ProviderRow {
  id: string;
  name: string;
  provider_type: string;
  model: string | null;
  api_base_url: string | null;
  request_format: RequestFormat | null;
  is_active: boolean;
}

export class ProviderError extends Error {
  constructor(
    public providerName: string,
    public status: number,
    message: string,
  ) {
    super(`${providerName} [${status}]: ${message}`);
  }
}

export async function providerSecret(admin: any, provider: ProviderRow) {
  const { data } = await admin.rpc("get_ai_provider_key_by_id", {
    p_id: provider.id,
  });
  let secret = typeof data === "string" ? data.trim() : "";
  if (!secret) {
    const envNames: Record<string, string> = {
      groq: "GROQ_API_KEY",
      lovable: "LOVABLE_API_KEY",
      sakana: "SAKANA_API_KEY",
    };
    const envName = envNames[provider.provider_type];
    if (envName) secret = Deno.env.get(envName)?.trim() ?? "";
  }
  return secret || null;
}

export async function loadProvider(admin: any, providerId: string) {
  const { data, error } = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model,api_base_url,request_format,is_active")
    .eq("id", providerId)
    .maybeSingle();
  if (error || !data) throw new Error("Provedor de IA não encontrado.");
  if (!data.is_active) throw new Error("Provedor de IA desativado.");
  const provider = data as ProviderRow;
  const secret = await providerSecret(admin, provider);
  if (!secret) throw new Error(`Credencial não configurada para ${provider.name}.`);
  return { provider, secret };
}

export async function fallbackProviders(admin: any, excludeId: string) {
  const { data } = await admin
    .from("ai_providers")
    .select("id,name,provider_type,model,api_base_url,request_format,is_active")
    .eq("is_active", true)
    .neq("id", excludeId)
    .order("is_recommended", { ascending: false })
    .order("name");
  return (data ?? []) as ProviderRow[];
}

async function openAiCompatible(
  provider: ProviderRow,
  secret: string,
  system: string,
  prompt: string,
) {
  if (!provider.api_base_url) {
    throw new Error(`${provider.name} não possui endpoint configurado.`);
  }
  const defaults: Record<string, string> = {
    groq: "llama-3.3-70b-versatile",
    openai: "gpt-4o-mini",
    lovable: "google/gemini-2.5-flash",
    perplexity: "sonar",
    sakana: "fugu",
  };
  const model = provider.model || defaults[provider.provider_type];
  if (!model) throw new Error(`${provider.name} não possui modelo configurado.`);

  const body: Record<string, unknown> = {
    model,
    temperature: 0,
    max_tokens: 5000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  };

  let response = await fetch(provider.api_base_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok && response.status === 400) {
    delete body.response_format;
    response = await fetch(provider.api_base_url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
  if (!response.ok) {
    throw new ProviderError(provider.name, response.status, await response.text());
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`${provider.name} retornou conteúdo vazio.`);
  return { text: String(text), model };
}

async function gemini(
  provider: ProviderRow,
  secret: string,
  system: string,
  prompt: string,
) {
  let model = provider.model || "gemini-2.0-flash";
  if (model.startsWith("google/")) model = model.slice(7);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${secret}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 5000,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new ProviderError(
      provider.name,
      response.status,
      JSON.stringify(data.error ?? data),
    );
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error(`${provider.name} retornou conteúdo vazio.`);
  return { text: String(text), model };
}

async function anthropic(
  provider: ProviderRow,
  secret: string,
  system: string,
  prompt: string,
) {
  const model = provider.model || "claude-3-5-sonnet-20241022";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": secret,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: 5000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new ProviderError(provider.name, response.status, await response.text());
  }
  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  if (!text) throw new Error(`${provider.name} retornou conteúdo vazio.`);
  return { text: String(text), model };
}

export async function runStructuredProvider(
  provider: ProviderRow,
  secret: string,
  system: string,
  prompt: string,
) {
  const format = provider.request_format ?? "openai_compatible";
  if (format === "gemini") return gemini(provider, secret, system, prompt);
  if (format === "anthropic") return anthropic(provider, secret, system, prompt);
  return openAiCompatible(provider, secret, system, prompt);
}

-- Axionn Briefing - adiciona OpenRouter como provedor de IA.
-- OpenRouter e API-compativel com OpenAI e permite rotear entre dezenas de modelos.

alter table public.ai_providers
  drop constraint if exists ai_providers_provider_type_check;

alter table public.ai_providers
  add constraint ai_providers_provider_type_check
  check (provider_type in (
    'lovable', 'openai', 'gemini', 'anthropic',
    'perplexity', 'sakana', 'groq', 'manus',
    'deepseek', 'mistral', 'ollama', 'xai',
    'azure_openai', 'cohere', 'custom', 'openrouter'
  ));

insert into public.ai_providers (name, provider_type, model, api_base_url, request_format, is_active, is_recommended)
select
  'OpenRouter',
  'openrouter',
  'openai/gpt-4o-mini',
  'https://openrouter.ai/api/v1/chat/completions',
  'openai_compatible',
  true,
  false
where not exists (
  select 1 from public.ai_providers where provider_type = 'openrouter'
);

comment on column public.ai_providers.provider_type is
  'Tipo do provedor: lovable, openai, gemini, anthropic, perplexity, sakana, groq, manus, deepseek, mistral, ollama, xai, azure_openai, cohere, custom, openrouter';

/**
 * SEC-001 — Validação de variáveis de ambiente
 *
 * Chamado no ponto de entrada da app (main.tsx) para garantir que
 * todas as variáveis críticas estão definidas antes de montar a UI.
 *
 * Em desenvolvimento, exibe warnings no console.
 * Em produção, lança erro que impede a app de iniciar sem config.
 */

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
}

const ENV_MANIFEST: EnvVar[] = [
  {
    key: "VITE_SUPABASE_URL",
    required: true,
    description: "URL do projeto Supabase (ex: https://xxx.supabase.co)",
  },
  {
    key: "VITE_SUPABASE_PUBLISHABLE_KEY",
    required: true,
    description: "Chave anon/public do Supabase",
  },
];

export function validateEnvVars(): void {
  const missing = ENV_MANIFEST.filter(
    ({ key, required }) => required && !import.meta.env[key]
  );

  if (missing.length === 0) return;

  const message = [
    "[SEC-001] ERRO: Variáveis de ambiente obrigatórias não configuradas:",
    ...missing.map(({ key, description }) => `  • ${key} — ${description}`),
    "",
    "Crie o arquivo .env na raiz do projeto com os valores corretos.",
    "Consulte .env.example para referência.",
  ].join("\n");

  if (import.meta.env.PROD) {
    throw new Error(message);
  } else {
    console.error(message);
  }
}

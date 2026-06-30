#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$ROOT_DIR/supabase/tests/database"

if [[ ! -d "$TEST_DIR" ]]; then
  echo "Diretório de testes não encontrado: $TEST_DIR" >&2
  exit 1
fi

mapfile -t TEST_FILES < <(find "$TEST_DIR" -maxdepth 1 -type f -name '*.test.sql' | sort)
if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
  echo "Nenhum teste pgTAP encontrado em: $TEST_DIR" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'EOF'
SUPABASE_DB_URL não foi informado.

Use uma conexão de banco de staging/local com privilégios suficientes para:
- criar extensão pgtap, se ainda não existir;
- inserir dados temporários em auth.users e tabelas públicas;
- executar set_tenancy_enforcement;
- executar rollback ao final.

Exemplo:
  SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
    bash scripts/run-tenant-isolation-tests.sh
EOF
  exit 2
fi

command -v psql >/dev/null 2>&1 || {
  echo "psql não encontrado no PATH." >&2
  exit 3
}

for test_file in "${TEST_FILES[@]}"; do
  echo "Executando $(basename "$test_file")"
  psql "$SUPABASE_DB_URL" \
    -v ON_ERROR_STOP=1 \
    -v client_min_messages=warning \
    -f "$test_file"
done

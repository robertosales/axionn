#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
OUTPUT_FILE="${MIGRATION_ORDER_OUTPUT:-}"

if [[ -n "$OUTPUT_FILE" ]]; then
  exec > >(tee "$OUTPUT_FILE") 2>&1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Diretório de migrations não encontrado: $MIGRATIONS_DIR" >&2
  exit 1
fi

mapfile -t MIGRATIONS < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | LC_ALL=C sort)

if [[ ${#MIGRATIONS[@]} -eq 0 ]]; then
  echo "Nenhuma migration SQL encontrada em: $MIGRATIONS_DIR" >&2
  exit 2
fi

declare -A VERSION_TO_FILE=()
declare -a INVALID_FILES=()
declare -a DUPLICATE_MESSAGES=()

for migration in "${MIGRATIONS[@]}"; do
  if [[ ! "$migration" =~ ^([0-9]{8,})_[A-Za-z0-9._-]+\.sql$ ]]; then
    INVALID_FILES+=("$migration")
    continue
  fi

  version="${BASH_REMATCH[1]}"
  if [[ -n "${VERSION_TO_FILE[$version]:-}" ]]; then
    DUPLICATE_MESSAGES+=("versão $version: ${VERSION_TO_FILE[$version]} <-> $migration")
  else
    VERSION_TO_FILE[$version]="$migration"
  fi
done

if [[ ${#INVALID_FILES[@]} -gt 0 ]]; then
  echo "Migrations com nome inválido. Use <versão_numérica>_<descrição>.sql:" >&2
  printf '  - %s\n' "${INVALID_FILES[@]}" >&2
fi

if [[ ${#DUPLICATE_MESSAGES[@]} -gt 0 ]]; then
  echo "Versões de migration duplicadas:" >&2
  printf '  - %s\n' "${DUPLICATE_MESSAGES[@]}" >&2
fi

if [[ ${#INVALID_FILES[@]} -gt 0 || ${#DUPLICATE_MESSAGES[@]} -gt 0 ]]; then
  echo "Preflight de migrations reprovado." >&2
  exit 3
fi

echo "# Ordem canônica de replay das migrations Supabase"
echo "# Gerada em UTC: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "# Total: ${#MIGRATIONS[@]}"

for index in "${!MIGRATIONS[@]}"; do
  printf '%04d  %s\n' "$((index + 1))" "${MIGRATIONS[$index]}"
done

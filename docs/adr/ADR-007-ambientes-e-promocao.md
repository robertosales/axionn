# ADR-007 — Banco via Lovable e promoção imutável

- Status: aceito
- Data: 2026-08-21

## Contexto

O Lovable Cloud é o backend remoto de produção do Axionn e não há staging persistente autorizado. Migrations, Edge Functions, secrets, cron e webhooks precisam ser aplicados pelo fluxo suportado do Lovable. O GitHub Actions não pode vincular a CLI nem escrever em projetos Supabase remotos.

O histórico contém cinco versões numéricas duplicadas de migrations. Como esses arquivos podem estar publicados, renomeá-los sem confrontar o estado do Lovable poderia corromper a rastreabilidade.

## Decisão

1. Toda mudança remota de banco ou Edge Function é preparada no repositório e executada pelo Lovable.
2. GitHub Actions faz somente inventário, análise estática, testes TypeScript e validação de contratos.
3. Workflows não recebem credenciais de banco e não executam `supabase link`, `db push`, `db reset`, `migration repair`, `functions deploy` ou `--linked`.
4. As cinco colisões existentes ficam numa allowlist exata e imutável. Qualquer nova colisão reprova o CI.
5. Migrations publicadas não são renomeadas nem reescritas. Correções usam versões novas e aditivas.
6. Cada lote remoto possui pacote Lovable com preflight, ordem, pós-validação, rollback e evidência de execução.
7. Uma release só é criada a partir de tag cujo commit já pertence a `main` e cuja versão coincide com `package.json`. O workflow não altera branches.

## Gates

- CI local/estático verde;
- pacote Lovable revisado;
- aplicação confirmada pelo operador do Lovable;
- pós-validação e jornadas afetadas aprovadas;
- PR protegido `develop → main` com revisão;
- tag criada somente depois do merge.

## Consequências

O CI não declara que migrations foram aplicadas nem substitui pgTAP remoto. A promoção permanece bloqueada até a devolução das evidências do Lovable. Em contrapartida, nenhuma credencial ou comando de mutação remota entra nos workflows do GitHub.

## Rollback

O rollback segue o arquivo específico do pacote Lovable ou uma migration aditiva de forward-fix. Nunca usar reset, repair ou reescrita do histórico remoto.

# Financeiro P0/P1/P2 - rollout e evidencias

Este pacote fecha o hardening financeiro sem alterar migrations publicadas e
segue a ADR-007. O GitHub Actions valida inventario e contratos estaticos; toda
operacao no banco remoto e executada pelo fluxo suportado do Lovable.

## Escopo imutavel

Aplicar somente depois de confrontar o estado fisico e o historico do ambiente:

1. `supabase/migrations/20260822000000_financeiro_status_concurrency.sql`;
2. `supabase/migrations/20260822010000_financeiro_integrity.sql`.

Nao renomear, reescrever, marcar manualmente como aplicada nem executar o lote
com `db push`, `db reset` ou `migration repair`.

## Gate 1 - preflight

1. Confirmar backup e janela operacional.
2. Executar `supabase/operations/20260822_01_financeiro_preflight.sql` no Lovable
   SQL Editor.
3. Guardar o resultado completo, incluindo banco, executor, horario e contagem
   por invariante.
4. Interromper se houver dependencia ausente ou se nao existir staff ativo com
   papel `admin`/`financeiro`.

Contagens legadas maiores que zero nao impedem a instalacao P1 porque as novas
constraints usam `NOT VALID`. Elas passam a proteger novas escritas, enquanto o
legado fica explicitamente pendente de saneamento.

## Gate 2 - aplicacao

1. Aplicar a migration P0 isoladamente e confirmar o commit atomico.
2. Aplicar a migration P1 isoladamente e confirmar o commit atomico.
3. Nao continuar se um objeto existente tiver definicao divergente.
4. Executar `supabase/operations/20260822_02_financeiro_post_validation.sql`.
5. Anexar ao ticket a lista de objetos, ACLs, invariantes e constraints ainda
   pendentes de validacao historica.

## Gate 3 - testes de banco

Em banco local/isolado autorizado com o schema atualizado, executar:

```bash
SUPABASE_DB_URL="postgresql://..." bash scripts/run-tenant-isolation-tests.sh
```

O arquivo `supabase/tests/database/22_backoffice_financial_integrity.test.sql`
prova constraints de escrita, funcoes efetivas, `SECURITY DEFINER`, ACLs,
idempotencia da geracao e locks/reconciliacao APF. Nunca apontar o runner pgTAP
para producao sem autorizacao explicita.

## Gate 4 - saneamento e validacao final

Se `get_backoffice_financial_integrity_violations()` retornar qualquer valor
maior que zero:

1. exportar apenas IDs e campos necessarios para o diagnostico;
2. obter decisao do responsavel financeiro para cada correcao;
3. criar uma nova operacao ou migration aditiva, revisada e auditavel;
4. nao ajustar valores, datas, moedas ou status automaticamente;
5. repetir a operacao 02 ate todas as contagens chegarem a zero.

Com zero violacoes, backup confirmado e janela aprovada, executar separadamente
`supabase/operations/20260822_03_financeiro_validate_constraints.sql`. A operacao
usa lock consultivo, reprova se o diagnostico deixar de estar zerado e valida as
11 constraints de forma atomica.

## Smoke funcional

Executar com um usuario `admin` ou `financeiro` em AAL2:

1. criar uma fatura valida e confirmar auditoria completa;
2. executar a geracao mensal duas vezes e confirmar que a segunda gera zero;
3. tentar duas transicoes concorrentes na mesma fatura e confirmar que apenas a
   primeira transicao valida e aceita;
4. vincular APF compativel e confirmar evento/auditoria;
5. rejeitar APF com organizacao, moeda, vencimento ou valor acumulado invalido;
6. confirmar que `anon` e usuario sem papel financeiro nao executam as RPCs.

## Rollback

- Falha durante uma migration ou durante a operacao 03 deve reverter a propria
  transacao; nao tentar completar parcialmente.
- A operacao 03 nao altera dados nem amplia bloqueios de escrita: as constraints
  ja eram aplicadas a novas linhas desde a migration P1. Nao ha rollback util
  para voltar uma constraint validada a `NOT VALID`.
- Defeito funcional depois do commit exige nova migration forward-fix. Nao
  remover constraints, restaurar funcoes antigas ou editar o historico remoto
  diretamente.
- Enquanto o forward-fix e preparado, suspender apenas a mutacao afetada no
  frontend; leitura, diagnostico e trilha de auditoria devem permanecer ativos.

## Evidencias obrigatorias

- commit/tag do codigo implantado;
- classificacao das duas migrations: aplicada, ja equivalente ou divergente;
- saidas integrais das operacoes 01 e 02;
- resultado pgTAP com 29 testes financeiros;
- contagens zeradas antes da operacao 03;
- saida `financial_constraints_validated`;
- smoke funcional com ator, horario, IDs tecnicos e resultado esperado;
- decisao GO/NO-GO e responsavel pela aprovacao financeira.

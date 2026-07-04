# Axion SaaS — Fase 2A / Lote 4: enforcement de limites

## Objetivo

Impedir, de forma transacional, que uma organização ultrapasse os limites efetivos de:

- `users.max`;
- `projects.max`;
- `contracts.max`.

## Comportamento

O controle é executado no banco antes da inclusão ou reativação do recurso:

- usuário: novo membership ativo ou reativação de membership;
- projeto: novo projeto não arquivado ou reativação de projeto arquivado;
- contrato: novo contrato ou transferência para outra organização.

O banco utiliza um advisory lock por organização e recurso para impedir que duas operações concorrentes ultrapassem o limite simultaneamente.

Quando o limite é atingido, a operação falha com:

```text
organization_resource_limit_reached
```

O detalhe do erro contém `org_id`, `feature_key`, quantidade utilizada e limite efetivo.

## Contagem

- usuários: memberships ativos;
- projetos: projetos com status diferente de `archived`;
- contratos: todos os contratos vinculados à organização.

A tela **Plano e uso** utiliza os mesmos critérios.

## Implantação no Lovable Cloud

Executar manualmente no SQL Editor, nesta ordem:

1. `supabase/migrations/20260704040000_organization_resource_limit_enforcement.sql`
2. `supabase/operations/20260704_04_enable_organization_resource_limits.sql`

Resultado obrigatório da segunda etapa:

```text
organization_resource_limit_enforcement_ok = true
```

A migration instala funções e triggers com o enforcement desligado. A operação seguinte executa o preflight e ativa o controle somente quando nenhuma organização estiver acima do próprio limite.

## Rollback

Executar:

`supabase/operations/20260704_04_resource_limits_rollback.sql`

Resultado esperado:

```text
organization_resource_limit_rollback_ok = true
```

O rollback apenas desliga a chave operacional. Ele não remove funções, triggers, organizações, usuários, projetos ou contratos.

## Preservação

O lote não altera:

- tenancy enforcement;
- APF;
- licenses;
- quotas de APF e IA;
- memberships existentes;
- projetos ou contratos existentes.

## Validação funcional

1. confirmar os valores na tela **Plano e uso**;
2. configurar um limite controlado em uma organização de teste;
3. criar recursos até atingir o limite;
4. confirmar que o último recurso permitido é criado;
5. tentar criar mais um recurso;
6. confirmar o erro `organization_resource_limit_reached`;
7. arquivar ou desativar um recurso e repetir a criação.

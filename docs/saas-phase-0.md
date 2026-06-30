# Axion SaaS — Fase 0: contenção e auditoria

## Objetivo

Preparar o Axion para pilotos empresariais controlados sem expor o sistema a cadastro público, consumo de IA sem governança ou acesso cruzado entre clientes.

Esta fase não declara o Axion pronto para self-service. A saída esperada é uma base auditável para iniciar a consolidação multi-tenant.

## Alterações implementadas no código

- cadastro público removido da tela de autenticação;
- OAuth público desligado por padrão;
- acesso apresentado como provisionado pela empresa contratante;
- fallback de contrato fixo removido da administração de usuários;
- Sentry Replay configurado para mascarar texto, inputs e mídia;
- configuração Supabase preparada para ambientes distintos;
- script de auditoria de RLS, grants e funções sensíveis adicionado ao repositório;
- tabela de eventos de consumo de IA criada;
- reserva de quota implementada de forma transacional por empresa e time;
- validação de vínculo do usuário ao time, contrato ou organização;
- funções que retornam chaves privilegiadas revogadas para `anon` e `authenticated`;
- Edge Function APF integrada ao controle de licença e quota;
- limite de prompt, arquivos, tamanho total, timeout e quantidade de fallbacks;
- teste de provider e chave inline restritos a administradores;
- sucesso e falha das chamadas registrados no banco;
- limites de rajada por usuário, por empresa e de chamadas concorrentes;
- CI ampliado para validar Edge Functions, frontend e contrato de segurança;
- configuração Deno e shim ESM adicionados para checagem tipada reproduzível da Edge Function.

## Decisões arquiteturais da fase

1. `organizations` será a raiz de tenancy.
2. `contracts`, `projects` e `teams` serão recursos pertencentes a uma organização.
3. papéis da plataforma serão separados dos papéis dos clientes;
4. nenhuma função de IA poderá executar sem organização, entitlement e reserva de quota;
5. migrations e testes de isolamento serão obrigatórios antes do self-service;
6. produção, staging e desenvolvimento usarão projetos Supabase separados.

## Governança de IA

As migrations de governança introduzem:

- `ai_usage_events`;
- `ai_usage_rate_limits`;
- `reserve_ai_usage`;
- `finalize_ai_usage`;
- incremento atômico de `licenses.ai_calls_used`;
- reset mensal de quota;
- validação de licença ativa e não expirada;
- validação transitória de membership por time, contrato, organização ou administrador da plataforma;
- limites padrão de 10 chamadas por usuário/minuto, 60 por empresa/minuto e 5 reservas concorrentes;
- possibilidade de configurar limites diferentes por empresa;
- revogação de acesso cliente a RPCs sensíveis.

A Edge Function aceita dois modos:

### `audit`

É o modo inicial de staging. A função tenta reservar quota e registra o erro, mas continua a execução quando a estrutura de licença ainda não estiver completa. Não deve ser utilizado em produção.

### `enforce`

Bloqueia chamadas sem empresa, licença ativa, vínculo do usuário ou quota disponível. Este é o modo obrigatório antes de pilotos pagos e em produção.

Configuração:

```bash
supabase secrets set AI_USAGE_ENFORCEMENT_MODE=audit
# Após validar empresas/licenças:
supabase secrets set AI_USAGE_ENFORCEMENT_MODE=enforce
```

## Ordem de implantação em staging

1. criar ou atualizar o projeto Supabase de staging;
2. aplicar todas as migrations de governança de IA;
3. cadastrar uma licença para cada empresa que utilizará APF/IA;
4. implantar a função `apf-generate`;
5. configurar os secrets documentados em `.env.example`;
6. iniciar com `AI_USAGE_ENFORCEMENT_MODE=audit`;
7. executar chamadas com usuário autorizado e não autorizado;
8. conferir `ai_usage_events` e `licenses.ai_calls_used`;
9. testar quota esgotada, licença expirada, usuário fora do time, rajada e concorrência;
10. mudar para `AI_USAGE_ENFORCEMENT_MODE=enforce`;
11. repetir todos os cenários antes de promover para produção.

## Checklist de auditoria

### Isolamento de dados

- [ ] inventariar todas as tabelas do schema `public`;
- [ ] confirmar RLS habilitado em todas as tabelas expostas;
- [ ] revisar policies de `SELECT`, `INSERT`, `UPDATE` e `DELETE`;
- [ ] identificar tabelas sem `organization_id` ou caminho inequívoco até a organização;
- [ ] revisar views com `security_invoker` e grants;
- [ ] testar acesso cruzado com dois usuários de organizações diferentes;
- [ ] revisar buckets e policies do Storage.

### Funções e privilégios

- [ ] revisar todos os grants para `anon` e `authenticated`;
- [x] revogar acesso cliente a funções conhecidas que retornem chaves ou service role;
- [x] novas funções de consumo utilizam `SECURITY DEFINER` com `search_path` fixo;
- [ ] revisar funções `SECURITY DEFINER` legadas e respectivos `search_path`;
- [ ] verificar se todas as funções administrativas validam papel e organização;
- [x] governança de IA executa com service role somente na Edge Function.

### Identidade e autorização

- [ ] separar `platform_admin` de `organization_admin`;
- [ ] consolidar `organization_members`, `contract_members`, `user_contracts` e `team_members`;
- [ ] remover dependência de `profiles.team_id`;
- [ ] planejar descontinuação de `profiles.module_access`;
- [ ] criar fluxo de convite empresarial transacional;
- [ ] exigir MFA para administradores antes do lançamento público.

### IA e custo

- [x] resolver time e empresa antes de executar IA;
- [x] validar licença ativa e não expirada;
- [x] reservar quota atomicamente;
- [x] limitar tamanho de prompt e arquivos;
- [x] aplicar limites de rajada por usuário e empresa;
- [x] limitar chamadas concorrentes;
- [x] limitar timeout e quantidade de fallbacks;
- [x] registrar provider, duração, resultado e contexto operacional;
- [ ] registrar tokens e custo monetário retornados por cada provider;
- [ ] impedir fallback para faixa de custo superior sem política de orçamento;
- [ ] criar alerta de anomalia de consumo.

### Operação

- [ ] criar Supabase de staging;
- [ ] separar variáveis e Vault por ambiente;
- [ ] validar backup e executar restauração de teste;
- [ ] definir SLOs e alertas;
- [ ] criar runbook de incidente;
- [x] adicionar validação de Edge Function e contrato de segurança ao CI;
- [ ] adicionar testes de RLS com banco efêmero ao CI;
- [ ] adicionar E2E ao CI;
- [ ] documentar rollback de frontend, migrations e Edge Functions.

## Critérios de saída

A Fase 0 termina somente quando:

1. nenhum usuário de uma organização consegue ler ou alterar dados de outra;
2. nenhuma chave privilegiada pode ser obtida por `anon` ou `authenticated`;
3. uma restauração de backup foi executada com sucesso;
4. staging funciona de forma independente da produção;
5. chamadas de IA estão em modo `enforce` e bloqueiam licença, quota, rajada ou acesso inválido;
6. o relatório de auditoria possui responsável, evidência e decisão para cada achado crítico.

## Próxima fase

A Fase 1 consolidará o modelo multi-tenant, migrando o sistema para `organization_id` como raiz obrigatória e introduzindo testes automatizados de isolamento.

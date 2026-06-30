# Axion SaaS — Fase 0: contenção e auditoria

## Objetivo

Preparar o Axion para pilotos empresariais controlados sem expor o sistema a cadastro público, consumo de IA sem governança ou acesso cruzado entre clientes.

Esta fase não declara o Axion pronto para self-service. A saída esperada é uma base auditável para iniciar a consolidação multi-tenant.

## Alterações iniciadas no código

- cadastro público removido da tela de autenticação;
- OAuth público desligado por padrão;
- acesso apresentado como provisionado pela empresa contratante;
- fallback de contrato fixo removido da administração de usuários;
- Sentry Replay configurado para mascarar texto, inputs e mídia;
- configuração Supabase preparada para ambientes distintos;
- script de auditoria de RLS, grants e funções sensíveis adicionado ao repositório.

## Decisões arquiteturais da fase

1. `organizations` será a raiz de tenancy.
2. `contracts`, `projects` e `teams` serão recursos pertencentes a uma organização.
3. papéis da plataforma serão separados dos papéis dos clientes;
4. nenhuma função de IA poderá executar sem organização, entitlement e reserva de quota;
5. migrations e testes de isolamento serão obrigatórios antes do self-service;
6. produção, staging e desenvolvimento usarão projetos Supabase separados.

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

- [ ] revisar grants para `anon` e `authenticated`;
- [ ] revogar acesso cliente a funções que retornem chaves ou service role;
- [ ] revisar funções `SECURITY DEFINER` e `search_path`;
- [ ] verificar se funções administrativas validam papel e organização;
- [ ] confirmar que webhooks e workers usam service role somente no servidor.

### Identidade e autorização

- [ ] separar `platform_admin` de `organization_admin`;
- [ ] consolidar `organization_members`, `contract_members`, `user_contracts` e `team_members`;
- [ ] remover dependência de `profiles.team_id`;
- [ ] planejar descontinuação de `profiles.module_access`;
- [ ] criar fluxo de convite empresarial transacional;
- [ ] exigir MFA para administradores antes do lançamento público.

### IA e custo

- [ ] resolver organização antes de executar IA;
- [ ] validar plano e entitlement;
- [ ] reservar quota atomicamente;
- [ ] limitar tamanho de prompt, arquivos e resposta;
- [ ] aplicar rate limit por usuário e organização;
- [ ] registrar provider, modelo, tokens, custo, duração e resultado;
- [ ] impedir fallback para provider mais caro sem orçamento explícito;
- [ ] criar alerta de anomalia de consumo.

### Operação

- [ ] criar Supabase de staging;
- [ ] separar variáveis e Vault por ambiente;
- [ ] validar backup e executar restauração de teste;
- [ ] definir SLOs e alertas;
- [ ] criar runbook de incidente;
- [ ] adicionar testes RLS, migration lint e E2E ao CI;
- [ ] documentar rollback de frontend, migrations e Edge Functions.

## Critérios de saída

A Fase 0 termina somente quando:

1. nenhum usuário de uma organização consegue ler ou alterar dados de outra;
2. nenhuma chave privilegiada pode ser obtida por `anon` ou `authenticated`;
3. uma restauração de backup foi executada com sucesso;
4. staging funciona de forma independente da produção;
5. chamadas de IA estão bloqueadas sem licença e quota;
6. o relatório de auditoria possui responsável, evidência e decisão para cada achado crítico.

## Próxima fase

A Fase 1 consolidará o modelo multi-tenant, migrando o sistema para `organization_id` como raiz obrigatória e introduzindo testes automatizados de isolamento.

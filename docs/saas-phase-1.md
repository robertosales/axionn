# Axion SaaS — Fase 1: fundação multi-tenant

## Objetivo

Consolidar `organizations` como raiz de tenancy sem interromper os vínculos atuais por empresa, contrato, projeto e time.

A ativação é gradual. O código permanece compatível com o modelo legado até que o backfill e os testes de isolamento sejam concluídos em staging.

## Lotes implementados

### 1. Papéis da plataforma

A tabela `platform_user_roles` separa responsabilidades internas do Axion dos papéis pertencentes às empresas clientes.

Papéis iniciais:

- `platform_admin`;
- `support_agent`;
- `billing_operator`.

Os usuários que atualmente possuem `user_roles.role = 'admin'` são copiados para `platform_admin` durante a migração, preservando o acesso existente. A remoção do papel legado `admin` será feita somente depois da migração do frontend e das policies.

### 2. Organização nos recursos centrais

Foram adicionadas colunas opcionais `org_id` a:

- `companies`;
- `teams`;
- `projects`.

`contracts.org_id` já existia.

O backfill só preenche um recurso quando os caminhos existentes apontam para uma única organização. Relações ambíguas permanecem nulas e devem ser corrigidas antes de tornar `org_id` obrigatório.

### 3. Funções canônicas

As migrations introduzem:

- `is_platform_admin`;
- `is_organization_member`;
- `is_organization_admin`;
- `resolve_contract_org_id`;
- `resolve_team_org_id`;
- `resolve_project_org_id`;
- `get_my_organizations_v2`;
- `get_accessible_teams_v2`.

As funções de resolução ficam restritas ao `service_role`. Para o frontend foram criadas variantes sem `user_id` explícito, que utilizam obrigatoriamente `auth.uid()`. As variantes que aceitam outro usuário foram revogadas para `authenticated`.

### 4. Contexto no frontend

`OrganizationProvider` mantém:

- organizações acessíveis;
- organização atual;
- papel do usuário;
- indicação de administrador da plataforma;
- indicação de administrador da organização;
- persistência da seleção no navegador;
- sincronização entre organização e time ativo;
- estado operacional da organização.

Ao trocar de organização, o time e o contrato anteriormente selecionados são invalidados quando não pertencem ao novo contexto.

### 5. Separação efetiva de administração

Quando `VITE_ORG_TENANCY_ENABLED=true`:

- `isAdmin` passa a representar apenas `platform_admin`;
- o papel global legado `admin` não concede acesso entre organizações;
- `/dashboard-admin` e `/contratos` permanecem exclusivos da plataforma;
- administradores de organização continuam limitados aos recursos da organização atual;
- times são carregados pela organização selecionada.

Com a flag desligada, `isAdmin` mantém o comportamento legado para não interromper produção durante a migração.

### 6. Seletor de organização

Foi adicionado um seletor global compacto que exibe organização, plano, status e papel. A troca redefine o time ativo e recarrega os recursos empresariais.

### 7. Isolamento de recursos empresariais

A Fase 1.3 adiciona escopo de organização a:

- empresas;
- contratos;
- projetos;
- times;
- vínculos contrato–time;
- vínculos contrato–sala;
- SLAs contratuais.

O frontend utiliza as RPCs:

- `get_accessible_companies_v2`;
- `get_accessible_contracts_v2`;
- `get_accessible_projects_v2`;
- `get_accessible_teams_v2`.

Criações recebem `org_id`; atualizações e exclusões incluem a organização na condição da operação. A importação de projetos também passa a utilizar o contexto persistido da organização.

### 8. Organizações suspensas e canceladas

Usuários comuns de organizações `suspended` ou `cancelled` ficam bloqueados nas rotas operacionais. O `platform_admin` mantém acesso para suporte e saneamento.

### 9. Enforcement progressivo no banco

A tabela `saas_runtime_settings` controla o isolamento restritivo no banco. A configuração inicial é:

```json
{"enabled": false}
```

As policies restritivas e os triggers já ficam instalados, mas a obrigatoriedade de `org_id` só passa a valer quando o backend executar, com `service_role`:

```sql
select set_tenancy_enforcement(true);
```

O frontend não possui permissão para alterar essa configuração.

### 10. Feature flag

A consulta multi-tenant só é ativada quando:

```env
VITE_ORG_TENANCY_ENABLED=true
```

O padrão permanece `false`, evitando chamadas às novas RPCs antes da aplicação das migrations no ambiente.

## Implantação em staging

1. aplicar `20260630020000_multitenant_foundation.sql`;
2. aplicar `20260630021000_org_access_wrappers.sql`;
3. aplicar `20260630022000_org_resource_isolation.sql`;
4. aplicar `20260630023000_org_resource_isolation_hardening.sql`;
5. executar a auditoria da Fase 0;
6. executar `get_tenancy_readiness_report()` com `service_role`;
7. eliminar registros sem `org_id` e vínculos divergentes;
8. confirmar os registros de `platform_user_roles`;
9. testar as RPCs com usuários de duas organizações distintas;
10. ativar `VITE_ORG_TENANCY_ENABLED=true` somente no staging;
11. validar troca de organização, time e contrato;
12. validar bloqueio de organizações suspensas e canceladas;
13. executar `set_tenancy_enforcement(true)` somente após o relatório retornar zero em todos os problemas;
14. repetir testes de leitura, criação, atualização e exclusão cruzadas;
15. manter produção com a flag e o enforcement desligados até aprovação formal.

## Consultas de verificação

```sql
select * from platform_user_roles order by created_at;
select * from get_my_organizations_v2();
select is_platform_admin();
select * from get_tenancy_readiness_report();

select set_tenancy_enforcement(true);
select set_tenancy_enforcement(false);
```

## Testes mínimos de isolamento

- usuário da organização A não lista contratos, projetos, empresas ou times da organização B;
- tentativa de atualizar um ID da organização B afeta zero registros;
- não é possível vincular contrato de A a time ou projeto de B;
- organização suspensa não cria nem altera recursos;
- `platform_admin` consegue selecionar organizações e realizar suporte;
- modo legado continua funcionando com a feature flag desligada.

## Próximos lotes da Fase 1

1. criar painéis próprios para owner e admin da organização;
2. migrar permissões de módulos para memberships organizacionais;
3. criar testes pgTAP executáveis no pipeline de staging;
4. consolidar memberships duplicadas;
5. tornar `org_id` obrigatório após o saneamento;
6. descontinuar o papel global legado `admin`.

## Critério de saída

A Fase 1 termina quando:

- todos os recursos centrais possuem `org_id` válido;
- nenhum administrador de organização recebe acesso global;
- `platform_admin` é o único papel com acesso entre organizações;
- todas as consultas operacionais são filtradas pela organização atual;
- testes automatizados provam isolamento de leitura e escrita;
- o modelo legado de administração global pode ser removido sem perda de acesso.

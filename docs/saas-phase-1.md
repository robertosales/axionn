# Axion SaaS — Fase 1: fundação multi-tenant

## Objetivo

Consolidar `organizations` como raiz de tenancy sem interromper os vínculos atuais por empresa, contrato, projeto e time.

A ativação é gradual. O código permanece compatível com o modelo legado até que o backfill e os testes de isolamento sejam concluídos em staging.

## Primeiro lote implementado

### Papéis da plataforma

A tabela `platform_user_roles` separa responsabilidades internas do Axion dos papéis pertencentes às empresas clientes.

Papéis iniciais:

- `platform_admin`;
- `support_agent`;
- `billing_operator`.

Os usuários que atualmente possuem `user_roles.role = 'admin'` são copiados para `platform_admin` durante a migração, preservando o acesso existente. A remoção do papel legado `admin` será feita somente depois da migração do frontend e das policies.

### Organização nos recursos centrais

Foram adicionadas colunas opcionais `org_id` a:

- `companies`;
- `teams`;
- `projects`.

`contracts.org_id` já existia.

O backfill só preenche um recurso quando os caminhos existentes apontam para uma única organização. Relações ambíguas permanecem nulas e devem ser corrigidas antes de tornar `org_id` obrigatório.

### Funções canônicas

A migration introduz:

- `is_platform_admin`;
- `is_organization_member`;
- `is_organization_admin`;
- `resolve_contract_org_id`;
- `resolve_team_org_id`;
- `resolve_project_org_id`;
- `get_my_organizations_v2`;
- `get_accessible_teams_v2`.

As funções de resolução ficam restritas ao `service_role`. As funções de leitura do próprio contexto podem ser executadas por usuários autenticados.

### Contexto no frontend

`OrganizationProvider` mantém:

- organizações acessíveis;
- organização atual;
- papel do usuário;
- indicação de administrador da plataforma;
- indicação de administrador da organização;
- persistência da seleção no navegador.

A consulta só é ativada quando:

```env
VITE_ORG_TENANCY_ENABLED=true
```

O padrão permanece `false`, evitando chamadas a RPCs antes da aplicação da migration no ambiente.

## Implantação em staging

1. aplicar `20260630020000_multitenant_foundation.sql`;
2. executar a auditoria da Fase 0;
3. consultar recursos com `org_id is null`;
4. revisar organizações ambíguas ou ausentes;
5. confirmar que os administradores atuais foram copiados para `platform_user_roles`;
6. testar `get_my_organizations_v2` com usuário comum, owner, admin e platform admin;
7. testar `get_accessible_teams_v2` com usuários de organizações diferentes;
8. ativar `VITE_ORG_TENANCY_ENABLED=true` somente no staging;
9. validar troca de organização e persistência da seleção;
10. manter produção com a flag desligada até os testes de isolamento passarem.

## Consultas de verificação

```sql
select count(*) from companies where org_id is null;
select count(*) from contracts where org_id is null;
select count(*) from teams where org_id is null;
select count(*) from projects where org_id is null;

select * from platform_user_roles order by created_at;
select * from get_my_organizations_v2();
```

## Próximos lotes da Fase 1

1. criar seletor visual de organização no shell da aplicação;
2. migrar `AuthContext` para distinguir `platform_admin` de `organization_admin`;
3. filtrar times, contratos e projetos pela organização atual;
4. substituir policies globais baseadas em `admin` por helpers de organização;
5. criar testes pgTAP de isolamento;
6. consolidar memberships duplicadas;
7. tornar `org_id` obrigatório após o saneamento;
8. descontinuar o papel global legado `admin`.

## Critério de saída

A Fase 1 termina quando:

- todos os recursos centrais possuem `org_id` válido;
- nenhum administrador de organização recebe acesso global;
- `platform_admin` é o único papel com acesso entre organizações;
- todas as consultas operacionais são filtradas pela organização atual;
- testes automatizados provam isolamento de leitura e escrita;
- o modelo legado de administração global pode ser removido sem perda de acesso.

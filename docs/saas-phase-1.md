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
- sincronização entre organização e time ativo.

Ao trocar de organização, o time anteriormente selecionado é removido e os times são carregados novamente por `get_accessible_teams_v2`.

### 5. Separação efetiva de administração

Quando `VITE_ORG_TENANCY_ENABLED=true`:

- `isAdmin` passa a representar apenas `platform_admin`;
- o papel global legado `admin` não concede acesso entre organizações;
- `/dashboard-admin` e `/contratos` permanecem exclusivos da plataforma;
- administradores de organização continuam limitados aos recursos da organização atual;
- times são carregados pela organização selecionada.

Com a flag desligada, `isAdmin` mantém o comportamento legado para não interromper produção durante a migração.

### 6. Seletor de organização

Foi adicionado um seletor global compacto:

- exibe a organização ativa;
- diferencia administrador da plataforma;
- apresenta status e plano;
- permite alternar entre organizações;
- redefine o time ativo ao trocar de contexto;
- mostra um aviso quando a conta não possui organização vinculada.

### 7. Feature flag

A consulta multi-tenant só é ativada quando:

```env
VITE_ORG_TENANCY_ENABLED=true
```

O padrão permanece `false`, evitando chamadas às novas RPCs antes da aplicação das migrations no ambiente.

## Implantação em staging

1. aplicar `20260630020000_multitenant_foundation.sql`;
2. aplicar `20260630021000_org_access_wrappers.sql`;
3. executar a auditoria da Fase 0;
4. consultar recursos com `org_id is null`;
5. revisar organizações ambíguas ou ausentes;
6. confirmar que os administradores atuais foram copiados para `platform_user_roles`;
7. testar `get_my_organizations_v2` com usuário comum, owner, admin e platform admin;
8. testar `get_accessible_teams_v2` com usuários de organizações diferentes;
9. ativar `VITE_ORG_TENANCY_ENABLED=true` somente no staging;
10. validar troca de organização, redefinição do time e persistência da seleção;
11. confirmar que administrador de organização não acessa `/dashboard-admin` ou `/contratos`;
12. manter produção com a flag desligada até os testes de isolamento passarem.

## Consultas de verificação

```sql
select count(*) from companies where org_id is null;
select count(*) from contracts where org_id is null;
select count(*) from teams where org_id is null;
select count(*) from projects where org_id is null;

select * from platform_user_roles order by created_at;
select * from get_my_organizations_v2();
select is_platform_admin();
```

## Próximos lotes da Fase 1

1. filtrar contratos e projetos pela organização atual;
2. criar painéis administrativos próprios da organização;
3. substituir policies globais baseadas em `admin` por helpers de organização;
4. bloquear organizações suspensas e canceladas para usuários comuns;
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

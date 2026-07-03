# Axion SaaS — runbook de rollout remoto no Lovable Cloud

## Objetivo

Organizar a preparação da instalação multi-tenant no banco remoto sem executar alterações automaticamente.

Este documento é apenas operacional. A branch não aplica migrations, não altera o histórico remoto e não ativa o enforcement.

## Estado validado

- `develop` reproduz as 237 migrations em banco efêmero.
- Testes pgTAP de contrato e isolamento estão aprovados.
- O banco remoto possui histórico registrado somente até `20260623180256`.
- A série `20260630*` está ausente ou parcialmente materializada.
- As migrations APF `20260702000026` a `20260702000031` possuem objetos fora do histórico, mas a equivalência integral ainda precisa ser comprovada.
- O enforcement remoto não está instalado.
- O contrato `2026/001` permanece sem organização definida.

## Regras obrigatórias

1. Não executar reset do banco remoto.
2. Não aplicar todas as migrations indiscriminadamente.
3. Não reparar o histórico em massa.
4. Não registrar uma migration como aplicada sem evidência de equivalência integral.
5. Não reaplicar migrations APF de dados apenas porque não aparecem no histórico.
6. Não ativar o enforcement durante o saneamento.
7. Produzir backup e plano de rollback antes de qualquer escrita.

## Gate 1 — preflight somente leitura

Executar o arquivo:

`supabase/audits/20260703_remote_rollout_preflight.sql`

Registrar:

- histórico das 16 migrations relevantes;
- objetos multi-tenant presentes e ausentes;
- definições finais das funções APF;
- índices, constraints, triggers e views da migration 31;
- quantidade de linhas ainda pendentes dos backfills 28 e 29;
- estado de RLS, policies e índices de `contract_teams`;
- contrato sem organização e organizações candidatas.

Nenhuma etapa posterior deve prosseguir se os resultados divergirem do estado esperado.

## Gate 2 — contrato sem organização

Confirmar formalmente a organização correta do contrato `2026/001` com o responsável pelo cadastro.

A existência atual de uma única organização não é, isoladamente, autorização para atribuição automática.

A futura correção deve usar o identificador exato do contrato, registrar o estado anterior e possuir validação pós-alteração e rollback documentado.

## Gate 3 — equivalência APF 26–31

Validar o estado cumulativo final, incluindo:

- colunas, tipos, defaults e constraints;
- definições completas das funções;
- definições de triggers e views;
- índices;
- grants e ACLs;
- efeitos verificáveis dos backfills.

Critérios específicos:

- Migration 28: nenhuma linha deve continuar satisfazendo a condição do backfill.
- Migration 29: análises históricas `legacy` devem estar preservadas sem revisão pendente.
- Migration 31: o índice único de `team_id + code` deve existir; valores nulos em `external_reference` só representam pendência quando o título contém referência HU/FUNC reconhecível.

A ausência no histórico, por si só, não autoriza reexecução.

## Gate 4 — série 20260630

Depois de backup e aprovação, a série deve ser tratada na ordem original:

1. governança de uso de IA;
2. limites de uso de IA;
3. compatibilidade temporária de UUID;
4. correção do trigger de auditoria;
5. compatibilidade de `contract_teams`;
6. fundação multi-tenant;
7. limpeza da compatibilidade temporária;
8. endurecimento dos wrappers de acesso;
9. isolamento progressivo de recursos;
10. hardening e relatório de prontidão.

Procedimento:

- tratar uma migration por vez;
- interromper no primeiro erro;
- registrar início, término e resultado;
- validar objetos e dados após cada etapa;
- manter o enforcement desligado durante todo o processo.

## Gate 5 — alinhamento do histórico

Alinhar somente migrations comprovadamente equivalentes.

Preferir o mecanismo oficial suportado pela plataforma, uma versão por vez, com evidências antes e depois.

As migrations 28 e 29 só podem ser consideradas equivalentes após a validação de funções e efeitos de dados.

A migration 31 só pode ser considerada equivalente quando índice único, constraint, função, trigger, view e consistência das referências estiverem confirmados.

## Gate 6 — validação pós-instalação

Antes de considerar ativação futura:

- relatório de prontidão sem inconsistências;
- enforcement ainda desligado;
- ao menos um administrador de plataforma;
- todas as organizações com owner ou admin;
- zero recursos centrais sem organização;
- zero vínculos cruzados;
- frontend validado com a feature flag ainda desligada;
- testes controlados com usuários de organizações distintas;
- backup e rollback verificados.

## Ativação futura

A ativação do enforcement é uma mudança independente, sujeita a aprovação formal. Ela não pertence ao preflight nem à instalação inicial.

## Gate 7 — canário da aplicação sem enforcement

Depois da Operação 4 aprovada, validar a aplicação com a infraestrutura tenant-aware instalada, mas com o enforcement do banco desligado.

Checklist:

- executar `supabase/operations/20260703_05_frontend_canary_validation.sql` no SQL Editor do Lovable;
- confirmar `public.is_tenancy_enforced() = false`;
- confirmar `saas_runtime_settings.tenancy_enforcement.enabled = false`;
- ligar `VITE_ORG_TENANCY_ENABLED=true` somente no ambiente de teste/canário do Lovable;
- validar login, seletor de organização e carregamento de times;
- validar listagem e navegação de empresas, contratos e projetos;
- validar APF, importação, sustentação, dashboards e relatórios principais;
- validar criação/edição controlada de empresa, contrato, time e projeto;
- não chamar `public.set_tenancy_enforcement(true)`.

Se o frontend retornar `42P17` com `infinite recursion detected in policy for relation "contracts"`, executar:

`supabase/operations/20260703_055_frontend_canary_rls_recursion_hotfix.sql`

Em seguida repetir a navegação do canário. O hotfix remove recursão entre `contracts`, `contract_teams`, `contract_room_teams` e `contract_slas` usando wrappers `SECURITY DEFINER`, sem ativar enforcement.

Quando o canário estiver funcional, executar:

`supabase/operations/20260703_06_frontend_canary_closeout_validation.sql`

O resultado esperado é `frontend_canary_closeout_ok_enforcement_off = true`. Esse fechamento confirma que o banco continua em modo compatível, sem ativar enforcement.

Depois da janela de observação com o canário funcional, executar:

`supabase/operations/20260703_07_canary_observation_gate.sql`

O resultado esperado é `canary_observation_gate_ok_enforcement_off = true`. Esse gate ainda não ativa enforcement; ele apenas confirma que a base continua pronta e que o canário permaneceu saudável.

Quando houver decisão de iniciar planejamento de ativação futura, executar:

`supabase/operations/20260703_08_enforcement_activation_preflight.sql`

O resultado esperado é `enforcement_activation_preflight_ok_enforcement_off = true`. Esse preflight ainda mantém o banco com `tenancy_enforcement=false` e não substitui aprovação formal, backup, janela e rollback.

Se o canário falhar, desligar apenas a feature flag de frontend e manter o banco no estado atual. O rollback de enforcement não se aplica porque o enforcement não foi ativado.

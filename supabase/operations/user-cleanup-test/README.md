# Limpeza total de usuários — ambiente de teste

Este diretório contém um procedimento em três fases. Nenhum dos arquivos é uma
migration e nada deve ser aplicado por deploy automático.

Para acesso exclusivamente pelo SQL Editor do Lovable, use
`03_simulate_cleanup_lovable.sql`. Ele contém SQL puro, valida o fingerprint e
termina obrigatoriamente em `ROLLBACK`. O arquivo `.psql` exige o cliente `psql`
e não deve ser colado no Lovable.

Após uma simulação aprovada, `04_execute_cleanup_lovable.sql` é o script final.
Ele permanece bloqueado pelo placeholder `PENDING_CONFIRMATION`; a frase exata
documentada no próprio arquivo deve ser digitada manualmente somente após backup
e autorização da janela. Todas as validações rodam antes do `COMMIT`.

Depois do commit, execute `05_post_cleanup_validation.sql` no Lovable. Ele é
somente leitura e todos os checks devem retornar `OK`.

Se `PERSONAL_ROWS_OUTSIDE_WHITELIST` falhar, execute
`06_diagnose_residual_personal_rows.sql` antes de decidir sobre qualquer remoção
adicional.

Para o estado diagnosticado em 2026-07-13, `07_simulate_orphan_residual_cleanup_lovable.sql`
simula, com rollback, a remoção dos 70 registros pertencentes aos dois UUIDs
históricos órfãos identificados.

Depois da simulação complementar aprovada, o script final correspondente é
`08_execute_orphan_residual_cleanup_lovable.sql`, também protegido por uma frase
de confirmação própria.

## Whitelist

A identidade é preservada pelo e-mail normalizado (`lower(trim(email))`):

- alissandra.teixeira@globalweb.com.br
- edsonrj@globalweb.com.br
- gabrielca@globalweb.com.br
- rafael.angelo@globalweb.com.br
- rjoacina@gmail.com
- roberto.sales@gmail.com
- leidybsb@gmail.com
- fatima.ferni@gmail.com

Os nomes informados são conferidos no inventário, mas o e-mail é a chave de
segurança porque `auth.users` não possui um campo de nome canônico.

## Execução segura

1. Execute `01_audit_dependencies.sql` no banco de teste e exporte todos os
   result sets.
2. Execute `02_dry_run.sql` na mesma sessão/conexão e revise:
   alvos, whitelist, FKs, referências heurísticas, Storage e manifestos.
3. Corrija qualquer linha marcada `BLOCKER`. Não execute a limpeza enquanto
   houver blocker ou membro da whitelist ausente/duplicado.
4. Registre `target_count` e `target_md5` emitidos pelo dry-run.
5. Faça backup/PITR e abra janela de manutenção sem criação de usuários.
6. Se o dry-run listar objetos de Storage, remova-os pela Storage API ou pelo
   Dashboard (bucket + nome do manifesto) e repita o dry-run. Não apague
   diretamente de `storage.objects`, pois isso pode deixar arquivos físicos órfãos.
7. Somente então execute `03_execute_cleanup.psql` pelo `psql`, fornecendo os
   parâmetros exigidos. O padrão é `ROLLBACK`; `commit_cleanup=YES` é necessário
   para confirmar.
8. Execute o checklist pós-limpeza abaixo.

Exemplo deliberadamente incompleto (preencher valores do dry-run):

```powershell
psql $env:TEST_DATABASE_URL `
  -v environment_name=test `
  -v confirmation=DELETE_NON_WHITELIST_USERS_FROM_AXIONN_TEST `
  -v expected_target_count=0 `
  -v expected_target_md5=00000000000000000000000000000000 `
  -v commit_cleanup=NO `
  -f supabase/operations/user-cleanup-test/03_execute_cleanup.psql
```

Primeiro rode com `commit_cleanup=NO`. Depois de conferir o relatório da própria
transação, repita com `commit_cleanup=YES`.

## Política de remoção e ordem

O script remove dados de identidade, associação e autoria que referenciem
diretamente os UUIDs-alvo ou os `profiles.id` correspondentes. Referências
indiretas (por exemplo, `activities.assignee_id -> developers.id`) seguem a ação
de FK definida no banco; por isso o inventário mostra `CASCADE`, `SET NULL`,
`RESTRICT` ou `NO ACTION` antes da execução.

Política aprovada para esta operação: registros pessoais, históricos, logs,
notificações, sessões de planejamento e tabelas de backup vinculados aos alvos
são excluídos. As entidades compartilhadas `demandas` e `teams` são preservadas;
somente `demandas.demandante` e `teams.created_by` são definidos como `NULL`.
Uma nova coluna heurística não incluída na allowlist continua sendo blocker.

Para `teams.created_by`, a tabela é bloqueada em modo exclusivo e apenas o
trigger `trg_team_org_consistency` é suspenso durante o update, pois ele valida a
organização inteira em qualquer alteração. O trigger é reabilitado imediatamente;
qualquer erro também restaura seu estado pelo rollback transacional. FKs e demais
triggers permanecem ativos.

Ordem efetiva:

1. verificação de que não restam objetos de Storage cujo `owner` ou primeiro
   segmento do nome seja o UUID (a remoção física ocorre antes, via API/Dashboard);
2. tabelas que referenciam `profiles(id)`;
3. tabelas que referenciam `profiles(user_id)`;
4. tabelas que referenciam `auth.users(id)`, exceto `profiles`;
5. `public.profiles`;
6. `auth.users` (as tabelas internas de Auth seguem as FKs do Supabase);
7. validações dentro da transação; `COMMIT` somente com confirmação.

Tabelas com relações entre si são tentadas repetidamente. Uma FK impeditiva faz
a transação abortar; constraints nunca são desabilitadas e `session_replication_role`
nunca é alterado.

## Checklist pós-limpeza

- [ ] Os 8 e-mails da whitelist existem exatamente uma vez em `auth.users`.
- [ ] Nenhum outro registro existe em `auth.users`.
- [ ] Os UUIDs da whitelist antes/depois são idênticos.
- [ ] Não há `profiles` órfãos nem usuário preservado sem profile (salvo exceção documentada).
- [ ] Não há memberships órfãs em times, organizações ou contratos.
- [ ] Não há permissões/roles de usuários removidos.
- [ ] Atividades e user stories continuam acessíveis; assignees afetados estão nulos ou válidos.
- [ ] Links, comentários, logs e auditorias seguem a política revisada no dry-run.
- [ ] Não há objetos de Storage pertencentes aos UUIDs removidos.
- [ ] Login e autorização foram testados para cada usuário preservado.
- [ ] Contagens de times, contratos, atividades e user stories foram comparadas ao inventário.
- [ ] Logs do `psql`, export do dry-run e identificação do backup foram anexados ao chamado.

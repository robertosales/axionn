# OKR V2 — PR 10: dashboard, exportação e hardening

## Escopo

O PR 10 adiciona o dashboard operacional e executivo do OKR V2, comparação
entre ciclos, consolidação por time e exportação governada por plano.

O frontend não agrega dados por consultas diretas nem carrega KRs em N+1.
`get_okr_dashboard_v1` retorna o agregado tenant-scoped. A exportação solicita
os dados a `request_okr_export_v1`, que valida RBAC, entitlement, formato e cota
mensal antes de registrar o evento.

## Ordem de rollout

1. Confirmar que as migrations dos PRs 1–9 estão aplicadas.
2. Aplicar `20260730160000_okr_v2_dashboard_export_hardening.sql`.
3. Executar `20260730_02_okr_v2_dashboard_export_validation.sql`.
4. Confirmar `okr_v2_dashboard_export_validation_ok = true`.
5. Publicar o frontend com `VITE_OKR_V2_ENABLED=true` no canário autorizado.
6. Validar a matriz abaixo antes de ampliar o rollout.

## Matriz de canário

| Perfil | Operacional | Executivo | CSV | PDF |
|---|---:|---:|---:|---:|
| Membro com `okr.view` | Sim | Não | Conforme RBAC/plano | Não |
| PO/SM com entitlement executivo | Sim | Sim | Conforme plano | Enterprise |
| Admin da organização | Sim | Sim | Conforme plano | Enterprise |
| Usuário externo ao tenant | Não | Não | Não | Não |

Validar também:

- troca de organização sem retenção de dados do tenant anterior;
- ciclo principal, comparação e estado sem dados;
- gráfico e tabela alternativa em 375, 768, 1024 e 1440 px;
- navegação somente por teclado e foco visível;
- tema claro e escuro;
- bloqueio do 11º CSV mensal no plano Intelligence;
- bloqueio de PDF fora do Enterprise;
- exportação sem fórmulas executáveis em células CSV.

## Observabilidade

O frontend registra `dashboard_viewed` e `report_exported` sem títulos,
descrições, nomes de pessoas ou conteúdo de KRs. Os metadados incluem apenas
modo, formato, quantidade de ciclos, linhas e duração.

Monitorar:

- falhas de `get_okr_dashboard_v1`;
- falhas e latência de `request_okr_export_v1`;
- crescimento de `okr_export_events`;
- Web Vitals e long tasks na rota `/okr/dashboard`;
- eventos de acesso negado e limite atingido.

## Rollback

O rollback funcional é não destrutivo:

1. definir `VITE_OKR_V2_ENABLED=false`;
2. republicar o frontend, retornando a navegação para `/okr`;
3. manter a migration e os eventos de exportação para auditoria.

Não remover tabelas, funções ou eventos durante a janela de observação. Uma
reversão estrutural, se necessária após a janela, exige migration nova e
autorização explícita.

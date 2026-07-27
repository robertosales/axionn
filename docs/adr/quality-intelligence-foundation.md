# ADR — Fundação do Axionn Quality Intelligence

## Estado

Aceita para o PR 1 na branch `develop`.

## Decisões

- O domínio é aditivo e usa `organization_id` como fronteira obrigatória.
- `public.projects` é canônica; `public.projetos` permanece legado.
- HUs e releases têm o tenant validado via `team_id` e `resolve_team_org_id`.
- Escritas críticas passam por RPCs transacionais; tabelas ficam disponíveis ao cliente apenas para leitura tenant-safe.
- A autoridade inicial de escrita é platform admin, organization admin ou admin organizacional do módulo `sala_agil`.
- Versões e snapshots são imutáveis.
- `audit_log_events` é reutilizada; não será criada uma auditoria paralela.
- Evidência por Storage fica fora do rollout inicial. O schema admite Storage, mas nenhum bucket é criado.
- Códigos são gerados por contador atômico por organização, sem `max + 1`.

## Consequências

- Papéis específicos de QA exigirão uma evolução posterior da autoridade organizacional.
- A UI permanece ausente e a feature flag nasce desligada.
- O schema remoto deve ser conferido no Lovable antes da aplicação, pois o histórico remoto possui drift conhecido.

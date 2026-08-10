# ETAPA 3 — CONTROLE DE MIGRATIONS

> Estado: M1–M4 CRIADAS — NÃO EXECUTADAS

| Migration planejada | Estado | Motivo |
| --- | --- | --- |
| M1 — `20260810130000_apf_profile_versioning_foundation.sql` | CRIADA / NÃO EXECUTADA | Perfis e versões aditivos; nenhuma migração de dados |
| M2 — `20260810130100_apf_versioned_ruleset_catalogs.sql` | CRIADA / NÃO EXECUTADA | Ruleset e catálogos tipados, sem defaults financeiros críticos |
| M3 — `20260810130200_apf_profile_version_lifecycle.sql` | CRIADA / NÃO EXECUTADA | Canonical JSON/SHA-256, vigência, overlap e imutabilidade |
| M4 — `20260810130300_apf_profile_security_audit.sql` | CRIADA / NÃO EXECUTADA | RLS, grants, audit e RPCs de transição/publicação/retirada |
| M5–M7 — snapshot e compatibilidade de sessão | NÃO CRIADAS | Dependem de M1–M4 e data de referência |
| M8 — engine v2 | NÃO CRIADA | Regras financeiras/arredondamento pendentes |
| M9 — Legacy v1 | NÃO CRIADA | Golden local criado; validação implantada pendente |
| M10–M11 — Shadow | NÃO CRIADAS | Dependem do engine v2 validado |
| M12–M14 — flags, observabilidade e strict | NÃO CRIADAS | Dependem dos gates anteriores |

## RPCs introduzidas em M4

- `transition_apf_profile_version(uuid,bigint,text,text)`;
- `publish_apf_profile_version(uuid,bigint,text)`;
- `retire_apf_profile_version(uuid,bigint,text)`.

Todas usam optimistic revision, locks de linha, autorização derivada do contrato e `SECURITY DEFINER SET search_path = public, pg_temp`. `admin_contrato` edita/submete draft; publicação/aprovação/retirada ficam restritas a owner/admin da organização como postura conservadora.

## Regra financeira

`rounding_mode`, `decimal_scale` e `rounding_stage` não possuem default. A publicação falha com `apf_profile_version_financial_policy_incomplete` enquanto estiverem incompletos. `billing_policy` não calcula PF faturável e M1–M4 não alteram o runtime.

Não houve execução de SQL, push, repair, reset ou alteração de banco. A suíte pgTAP foi criada, mas permanece não executada pela ausência de Supabase CLI/PostgreSQL local.

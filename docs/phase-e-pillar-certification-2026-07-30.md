# Certificação individual dos pilares — Fase E

Data-base: 2026-07-30
Branch avaliado: `develop`

Um pilar somente recebe **Produção certificada** quando há evidência do fluxo real,
isolamento tenant, observabilidade, SLO, ownership, runbook e rollback.

| Pilar | Classificação atual | Pendência para produção |
|---|---|---|
| Git | MVP | smoke real, SLO, retries/DLQ e owner |
| DORA | Fundação | cálculo com eventos reais e reconciliação |
| Risco de sprint | Fundação | calibração, drift, explicabilidade e SLO |
| Teams | MVP | canário Microsoft real, rate limit, retries e rollback |
| Copilot | Fundação | dependência real, observabilidade e owner |
| Integrações corporativas | MVP | certificar cada conector, secrets, DLQ e correlação |
| Relatórios | Fundação | consistência, exportação real, SLO e rollback |

Nenhum pilar é marcado como Produção certificada sem execução contra dependências
reais. Git, Teams e integrações corporativas estão em **MVP**; DORA, risco de
sprint, Copilot e relatórios permanecem em **Fundação**.

Para elevar um pilar, o canário deve registrar ambiente, tenant, papel, versão,
correlação e logs; demonstrar segurança cross-tenant; observar retry e rate limit;
e possuir SLO, owner, alerta, runbook, rollback e aprovações nominais.

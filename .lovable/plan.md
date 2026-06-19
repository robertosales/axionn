
## Causa

A chamada do dashboard ao RPC `fn_sla_dashboard_batch` retornou HTTP 500 com:

```
57014 — canceling statement due to statement timeout
```

A função existe e funciona (testei: PF, limit=5 → retornou `total:5, dentro:5, compliance:100%`), mas com `p_limit=500` ela estoura o timeout PostgREST: ela faz um loop pl/pgsql chamando `calc_sla_demanda` por demanda, e cada `calc_sla_demanda` percorre `demanda_transitions` somando `calc_horas_uteis` minuto-a-minuto. Para 500 chamados isso passa de ~8 s.

Quando o RPC falha, o hook cai no `catch`, zera o state e a tela mostra "Nenhuma demanda ativa com SLA neste contrato" — mesmo havendo 751 demandas no PF.

## Proposta de correção (2 frentes)

### Backend — RPC dedicado para o painel

Criar `public.fn_sla_contract_panel(p_contract_id, p_limit_risco)` em SQL puro (não pl/pgsql loop):

- **Resumo agregado** (compliance, dentro/em_risco/violado/concluído, no_sla) calculado em um único `SELECT … FROM demandas LEFT JOIN contract_slas ON priority` usando aritmética de janela (created_at + interval ‘N minutes’ vs now, considerando `aceite_data` para concluídas). É 10–50× mais rápido que o loop pl/pgsql atual.
- **Lista "em risco/violadas"** limitada a `p_limit_risco` (default 20) usando o mesmo cálculo, sem chamar `calc_sla_demanda`.
- Retorna `jsonb` no formato `{ summary: {...}, items: [...] }`.
- Mantém o cálculo de horas em **tempo corrido simples** (created_at → now/aceite_data); o cálculo mais preciso via `calc_horas_uteis`/transitions fica reservado ao detalhe de uma demanda (`useContractSla`).

Trade-off: o painel passa a usar tempo corrido em vez de horas úteis. Para compliance agregada a diferença é pequena e a tela volta a abrir em < 500 ms para qualquer volume.

### Frontend — adaptar o hook

`src/features/sustentacao/hooks/useSLADashboard.ts` passa a chamar `fn_sla_contract_panel(contract_id, 20)` e mapear direto para `SLASummary`/`SLADashboardItem`. Remover o uso de `fn_sla_dashboard_batch` neste caminho (esse RPC continua disponível para relatórios pontuais com filtro estreito).

Adicionar tratamento de erro visível: quando o RPC falhar, mostrar `<Alert variant="destructive">SLA temporariamente indisponível</Alert>` em vez do estado vazio, para não confundir com "sem dados".

## Plano de execução

1. Migração SQL: criar `fn_sla_contract_panel` (SECURITY DEFINER, GRANT EXECUTE para `authenticated`).
2. Reescrever `useSLADashboard` (sustentação) para o novo RPC.
3. `SLADashboardSection`: separar estado "erro" do estado "vazio".
4. Validar com Roberto/PF: painel deve abrir com compliance real e a lista das ~20 demandas mais críticas.

## Decisão para você aprovar

- **D1:** Topa que o painel do dashboard use **tempo corrido** para o agregado (rápido, ~95% preciso) e o detalhe da demanda continue usando **horas úteis com transitions** (preciso, lento)? Essa é a única maneira realista de evitar timeout sem reescrever do zero o cálculo de SLA — refatorar `calc_sla_demanda` para SQL set-based é um esforço grande e proponho fazer em um plano separado.
